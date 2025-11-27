# -*- coding: utf-8 -*-
from odoo import api, fields, models

class PosConfig(models.Model):
    """Config POS: multi-moneda por sesión."""
    _inherit = 'pos.config'

    enable_multicurrency = fields.Boolean(
        string='Enable Multi Currency',
        help='Allow multiple currencies in POS sessions.'
    )
    currency_ids = fields.Many2many(
        'res.currency',
        string='Allowed Currencies',
        help='Currencies available for POS transactions.'
    )

    @api.model
    def get_config_settings(self, config_id):
        """Devuelve las monedas configuradas para el POS."""
        config = self.browse(int(config_id))
        result = []
        for currency in config.currency_ids:
            result.append({
                'id': currency.id,
                'name': currency.name,
                'symbol': currency.symbol,
                'rate': currency.rate,
            })
        return result

    @api.model
    def get_selected_currency(self, selected_id):
        """Devuelve info de la moneda seleccionada."""
        currency = self.env['res.currency'].browse(int(selected_id))
        usd_val = round(1 / currency.rate, 2) if currency.rate else 0.0
        return [{
            'id': currency.id,
            'name': currency.name,
            'symbol': currency.symbol,
            'rate': currency.rate,
            'usd_val': usd_val,
        }]