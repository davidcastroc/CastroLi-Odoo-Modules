# -*- coding: utf-8 -*-
from odoo import api, models

class PosOrder(models.Model):
    _inherit = 'pos.order'

    @api.model
    def _payment_fields(self, order, ui_paymentline):
        """Extiende payload de pago con moneda y monto en moneda."""
        return {
            'amount': ui_paymentline['amount'] or 0.0,
            'payment_date': ui_paymentline['name'],
            'payment_method_id': ui_paymentline['payment_method_id'],
            'card_type': ui_paymentline.get('card_type'),
            'cardholder_name': ui_paymentline.get('cardholder_name'),
            'transaction_id': ui_paymentline.get('transaction_id'),
            'payment_status': ui_paymentline.get('payment_status'),
            'ticket': ui_paymentline.get('ticket'),
            'pos_order_id': order.id,
            'payment_currency': ui_paymentline.get('payment_currency'),
            'currency_amount': ui_paymentline.get('currency_amount'),
        }