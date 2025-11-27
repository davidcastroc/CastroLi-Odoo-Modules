/** @odoo-module **/

import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { patch } from "@web/core/utils/patch";
import { useState, onMounted } from "@odoo/owl";

let current_currency, currency_id;

patch(PaymentScreen.prototype, {
    setup() {
        super.setup();
        this.current_currency = useState({
            rate: 1,
            display_name: "",
            symbol: "",
        });

        this.multi_currency = useState({
            currencies: [],
            usd_val: "",
            name: "",
            total: "",
            symbol: "",
            rate: "",
        });

        const currency = [];
        onMounted(() => {
            this.multi_currency.currencies = currency;
            this.enable_multi_currency();
        });
        currency.push(this.pos.currency.currency_params);

        this.env.bus.addEventListener(
            "multi-payment-line",
            this.multi_currency_payment_line.bind(this)
        );
    },

    enable_multi_currency() {
        if (!this.pos.config.enable_multicurrency) {
            document.querySelectorAll(".pos_multicurrency").forEach(
                (el) => (el.style.display = "none")
            );
        }
    },

    show_options() {
        const container = document.querySelector(".multicurrency_container");
        const list = document.querySelector(".currecy_list");

        if (container.style.display === "none") {
            container.style.display = "flex";
            container.style.flexDirection = "column";
            container.style.alignItems = "center";

            list.innerHTML = "";
            for (const cur of this.multi_currency.currencies[0]) {
                list.insertAdjacentHTML(
                    "beforeend",
                    `<option id="${cur.id}">${cur.display_name}</option>`
                );
            }
        } else {
            list.innerHTML = "";
            container.style.display = "none";
        }
    },

    compute_currency(ev) {
        currency_id = document.querySelector(".currecy_list").value;
        const container = document.querySelector(".conversion_container");

        if (currency_id) {
            current_currency = this.multi_currency.currencies[0].find(
                (item) => item.id === parseInt(currency_id)
            );

            const totalText =
                document.querySelector(".total")?.innerText ||
                document.querySelector(".payment-status-remaining")?.children[1]
                    ?.innerText;
            const total_value = parseFloat(totalText.replace(/[^\d.]/g, ""));

            container.style.display = current_currency.rate ? "block" : "none";
            document.querySelector(".rate_string").innerText =
                current_currency.rate_string || "";
            document.querySelector(".total_amount").innerText =
                (current_currency.rate * total_value).toFixed(2);
        } else {
            container.style.display = "none";
        }
    },

    async multi_currency_payment_line(ev) {
        if (!this.pos.config.enable_multicurrency) return;

        const amount_val = parseFloat(
            document.querySelector(".multicurrency_input").value
        );
        const totalText =
            document.querySelector(".total")?.innerText ||
            document.querySelector(".payment-status-remaining")?.children[1]
                ?.innerText;
        const total_val = parseFloat(totalText.replace(/[^\d.]/g, ""));

        if (amount_val && total_val > 0) {
            this.addNewPaymentLine(ev);
            const update_amount = amount_val / current_currency.rate;
            await this.selectedPaymentLine.set_amount(update_amount);
            this.selectedPaymentLine.converted_currency = {
                name: current_currency.display_name,
                symbol: current_currency.symbol,
                amount: amount_val,
            };
            document.querySelector(".multicurrency_input").value = "";
            document.querySelector(".conversion_container").style.display =
                "none";
        } else {
            document.querySelector(".multicurrency_input").style.border =
                "1.5px solid red";
        }
    },

    deletePaymentLine() {
        super.deletePaymentLine(...arguments);
        document.querySelector(".currecy_list").selectedIndex = 0;
        document.querySelector(".conversion_container").style.display = "none";
    },

    _updateSelectedPaymentline() {
        super._updateSelectedPaymentline(...arguments);
        if (this.pos.config.enable_multicurrency && this.selectedPaymentLine) {
            const change_amount =
                this.selectedPaymentLine.amount * current_currency.rate;
            this.selectedPaymentLine.converted_currency = {
                name: current_currency.display_name,
                symbol: current_currency.symbol,
                amount: change_amount,
            };
        }
    },

    async _finalizeValidation() {
        const paymentLines = this.currentOrder.paymentlines;
        paymentLines.forEach((line) => {
            if (line.converted_currency) {
                line.payment_currency = line.converted_currency.name;
                line.currency_amount = line.converted_currency.amount;
                line.currency_symbol = line.converted_currency.symbol;
            }
        });
        await super._finalizeValidation();
    },
});