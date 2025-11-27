/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { onMounted } from "@odoo/owl";

/* ===================================================
 * PATCH: PosStore._save_to_server (guarda info de conversión)
 * =================================================== */
patch(PosStore.prototype, {
    async _save_to_server(orders, options) {
        try {
            if (orders && orders.length > 0) {
                const first = orders[0];
                const statements = Array.isArray(first.data.statement_ids)
                    ? first.data.statement_ids
                    : [];

                for (let i = 0; i < statements.length; i++) {
                    let stLine = statements[i];
                    if (!Array.isArray(stLine)) stLine = [0, 0, {}];
                    const vals = stLine[2] || {};
                    const paymentLine =
                        this.orders?.[0]?.paymentlines?.[i] || null;

                    if (paymentLine?.converted_currency) {
                        vals.currency_amount = paymentLine.converted_currency.amount;
                        vals.payment_currency = paymentLine.converted_currency.name;
                        vals.currency_symbol = paymentLine.converted_currency.symbol;
                    } else {
                        vals.currency_amount = "";
                        vals.payment_currency = "";
                        vals.currency_symbol = "";
                    }
                    statements[i] = [stLine[0], stLine[1], vals];
                }
            }

            if (!orders?.length) return [];

            const ordersToSync = orders.filter((o) => !this.syncingOrders.has(o.id));
            if (!ordersToSync.length) return [];

            ordersToSync.forEach((o) => this.syncingOrders.add(o.id));
            this.set_synch("connecting", ordersToSync.length);

            const orm = options?.to_invoice ? this.orm : this.orm.silent;

            const serverIds = await orm.call(
                "pos.order",
                "create_from_ui",
                [ordersToSync, options?.draft || false],
                { context: this._getCreateOrderContext(ordersToSync, options) }
            );

            for (const srv of serverIds) {
                const order = this.env.services.pos.orders.find(
                    (o) => o.name === srv.pos_reference
                );
                if (order) order.server_id = srv.id;
            }

            for (const o of ordersToSync) this.db.remove_order(o.id);

            this.failed = false;
            this.set_synch("connected");
            return serverIds;
        } catch (error) {
            console.warn("Failed to send orders:", error);
            this.set_synch(error?.code === 200 ? "error" : "disconnected");
            throw error;
        } finally {
            (orders || []).forEach((o) => this.syncingOrders.delete(o.id));
        }
    },
});

/* ===================================================
 * PATCH: PaymentScreen (UI + lógica completa)
 * =================================================== */

let current_currency = null; // Moneda actual seleccionada

patch(PaymentScreen.prototype, {
    setup() {
        super.setup();
        this.multi_currency = { currencies: [] };

        // 🔹 Cargar monedas activas directamente desde el backend
        this.env.services.orm
            .call("res.currency", "search_read", [
                [["active", "=", true]],
                ["id", "name", "symbol", "rate"],
            ])
            .then((currencies) => {
                this.multi_currency.currencies = currencies.map((c) => ({
                    id: c.id,
                    display_name: `${c.symbol} ${c.name}`,
                    name: c.name,
                    symbol: c.symbol,
                    rate: c.rate,
                    rate_string: `1 base = ${(1 / c.rate).toFixed(4)} ${c.name}`,
                }));
                this._populateCurrencyList();
            })
            .catch((err) => {
                console.warn("⚠️ No se pudieron cargar las monedas:", err);
            });

        // 👇 Inyectar UI al montar el componente
        onMounted(() => {
            this.injectMultiCurrencyUI();
        });
    },

    /* ====================== Helpers ====================== */

    _populateCurrencyList() {
        const select = document.querySelector(".currecy_list");
        if (!select) return;
        select.innerHTML = '<option value="">Choose</option>';
        for (const cur of this.multi_currency.currencies) {
            const opt = document.createElement("option");
            opt.value = String(cur.id);
            opt.textContent = cur.display_name;
            select.appendChild(opt);
        }
    },

    _getTotalDisplayed() {
        const totalText =
            document.querySelector(".total")?.innerText ||
            document.querySelector(".payment-status-remaining")?.children?.[1]?.innerText ||
            "";
        return parseFloat(totalText.replace(/[^\d.]/g, "")) || 0;
    },

    _getCashMethodFromConfig() {
        const pm = (this.payment_methods_from_config || []).find(
            (m) => m.type === "cash" || m.is_cash_count
        );
        return pm || (this.payment_methods_from_config || [])[0];
    },

    /* ====================== UI ====================== */

    injectMultiCurrencyUI() {
        if (document.querySelector(".pos_multicurrency")) return;

        const paymentSummary = document.querySelector(".payment-summary");
        if (!paymentSummary) {
            console.warn("⚠️ No se encontró .payment-summary para insertar UI multicurrency");
            return;
        }

        const html = `
            <div class="pos_multicurrency" style="display:flex;justify-content:center;align-items:center;margin:10px 0;">
                <h3 style="margin-right:10px;">MultiCurrency</h3>
                <input type="checkbox" id="multi_currency_check"/>
            </div>
            <div class="multicurrency_container" style="display:none;flex-direction:column;align-items:center;">
                <div>
                    <label><b>Select Currency:</b></label>
                    <select class="currecy_list" style="width:100%;background:#a8a8a8;border:none;border-radius:2px;">
                        <option value="">Choose</option>
                    </select>
                </div>
                <div class="conversion_container" style="display:none;margin-top:10px;text-align:center;">
                    <div><b>Currency Conversion</b></div>
                    <div class="rate_string"></div>
                    <div>Total Amount = <span class="total_amount"></span></div>
                    <br/>
                    <div>
                        <label>Payment Amount In</label>
                        <input type="number" class="multicurrency_input"/>
                    </div>
                    <br/>
                    <div class="button addpayment" style="display:flex;align-items:center;justify-content:center;cursor:pointer;">
                        <div style="border:2px solid black;padding:6px 10px;width:54%;">Add Cash Payment</div>
                    </div>
                </div>
            </div>
        `;

        paymentSummary.insertAdjacentHTML("afterend", html);

        // 🎯 Eventos UI
        const checkbox = document.querySelector("#multi_currency_check");
        const container = document.querySelector(".multicurrency_container");
        const select = document.querySelector(".currecy_list");
        const conversion = document.querySelector(".conversion_container");
        const addPaymentBtn = document.querySelector(".addpayment");
        const input = document.querySelector(".multicurrency_input");

        checkbox?.addEventListener("change", () => {
            container.style.display = checkbox.checked ? "flex" : "none";
        });

        select?.addEventListener("change", () => {
            this.compute_currency();
            conversion.style.display = select.value ? "block" : "none";
        });

        addPaymentBtn?.addEventListener("click", (ev) => {
            this.multi_currency_payment_line(ev);
        });

        input?.addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.multi_currency_payment_line(e);
        });

        console.log("✅ MultiCurrency UI renderizado y enlazado correctamente");
    },

    /* ====================== Lógica ====================== */

    compute_currency() {
        const listEl = document.querySelector(".currecy_list");
        const container = document.querySelector(".conversion_container");
        const rateStrEl = document.querySelector(".rate_string");
        const totalAmountEl = document.querySelector(".total_amount");
        if (!listEl || !container) return;

        const currency_id = parseInt(listEl.value || "0", 10);
        if (!currency_id) {
            container.style.display = "none";
            return;
        }

        const currencies = this.multi_currency.currencies || [];
        current_currency = currencies.find((c) => c.id === currency_id);
        if (!current_currency) {
            container.style.display = "none";
            return;
        }

        const total_value = this._getTotalDisplayed();
        container.style.display = current_currency.rate ? "block" : "none";
        if (rateStrEl) rateStrEl.textContent = current_currency.rate_string || "";
        if (totalAmountEl)
            totalAmountEl.textContent = (current_currency.rate * total_value).toFixed(2);
    },

    async multi_currency_payment_line(ev) {
        if (!this.pos?.config?.enable_multicurrency) return;

        const inputEl = document.querySelector(".multicurrency_input");
        const conversion = document.querySelector(".conversion_container");
        if (!inputEl || !current_currency?.rate) return;

        const amount_val = parseFloat(inputEl.value || "0") || 0;
        const total_val = this._getTotalDisplayed();
        if (!(amount_val > 0 && total_val > 0)) {
            inputEl.style.border = "1.5px solid red";
            return;
        }

        const cashMethod = this._getCashMethodFromConfig();
        if (!cashMethod) {
            console.warn("⚠️ No hay método de pago configurado; no se puede agregar línea");
            return;
        }

        this.addNewPaymentLine(cashMethod);
        const base_amount = amount_val / current_currency.rate;
        await this.selectedPaymentLine.set_amount(base_amount);

        this.selectedPaymentLine.converted_currency = {
            name: current_currency.display_name || current_currency.name,
            symbol: current_currency.symbol || "",
            amount: amount_val,
        };

        inputEl.value = "";
        if (conversion) conversion.style.display = "none";
    },

    deletePaymentLine() {
        super.deletePaymentLine(...arguments);
        const list = document.querySelector(".currecy_list");
        if (list) list.selectedIndex = 0;
        const conv = document.querySelector(".conversion_container");
        if (conv) conv.style.display = "none";
    },

    async _finalizeValidation() {
        const paymentLines = this.currentOrder?.paymentlines || [];
        for (const line of paymentLines) {
            if (line.converted_currency) {
                line.payment_currency = line.converted_currency.name;
                line.currency_amount = line.converted_currency.amount;
                line.currency_symbol = line.converted_currency.symbol;
            }
        }
        await super._finalizeValidation();
    },
});