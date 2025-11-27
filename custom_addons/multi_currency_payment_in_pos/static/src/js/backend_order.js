/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { Payment } from "@point_of_sale/app/store/models";

patch(PosStore.prototype, {
    async _save_to_server(orders, options) {
        if (orders.length > 0) {
            for (let i = 0; i < orders[0].data.statement_ids.length; i++) {
                const paymentLine = this.orders[0].paymentlines[i];
                if (paymentLine) {
                    if (paymentLine.converted_currency) {
                        orders[0].data.statement_ids[i][2].currency_amount =
                            paymentLine.converted_currency.amount;
                        orders[0].data.statement_ids[i][2].payment_currency =
                            paymentLine.converted_currency.name;
                    } else {
                        orders[0].data.statement_ids[i][2].currency_amount = "";
                        orders[0].data.statement_ids[i][2].payment_currency = "";
                    }
                }
            }
        }

        if (!orders || !orders.length) return Promise.resolve([]);

        const ordersToSync = orders.filter(
            (order) => !this.syncingOrders.has(order.id)
        );
        if (!ordersToSync.length) return Promise.resolve([]);

        ordersToSync.forEach((order) => this.syncingOrders.add(order.id));
        this.set_synch("connecting", ordersToSync.length);

        const orm = options?.to_invoice ? this.orm : this.orm.silent;

        try {
            const serverIds = await orm.call(
                "pos.order",
                "create_from_ui",
                [ordersToSync, options?.draft || false],
                { context: this._getCreateOrderContext(ordersToSync, options) }
            );

            for (const serverId of serverIds) {
                const order = this.env.services.pos.orders.find(
                    (o) => o.name === serverId.pos_reference
                );
                if (order) order.server_id = serverId.id;
            }

            for (const order of ordersToSync) this.db.remove_order(order.id);
            this.failed = false;
            this.set_synch("connected");
            return serverIds;
        } catch (error) {
            console.warn("Failed to send orders:", ordersToSync);
            this.set_synch(error.code === 200 ? "error" : "disconnected");
            throw error;
        } finally {
            ordersToSync.forEach((order) =>
                this.syncingOrders.delete(order.id)
            );
        }
    },
});

patch(Payment.prototype, {
    export_for_printing() {
        const result = super.export_for_printing(...arguments);
        if (this.converted_currency) {
            result.converted_currency_amount = this.converted_currency.amount;
            result.converted_currency_name = this.converted_currency.name;
            result.converted_currency_symbol = this.converted_currency.symbol;
            this.currency_amount = this.converted_currency.amount;
        }
        return result;
    },
});
