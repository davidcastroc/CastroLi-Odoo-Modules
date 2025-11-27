# -*- coding: utf-8 -*-
{
    'name': 'Multi Currency in POS',
    'version': '18.0.1.0.0',
    'summary': 'Pagos en múltiples monedas en el Punto de Venta.',
    'category': 'Point of Sale',
    'author': 'CastroLi',
    'license': 'AGPL-3',
    'depends': ['point_of_sale'],
    'assets': {
        'point_of_sale.assets_prod': [
            'multi_currency_payment_in_pos/static/src/js/multicurrency_pos.js',
        ],
        'point_of_sale.assets_debug': [
            'multi_currency_payment_in_pos/static/src/js/multicurrency_pos.js',
        ],
    },
    'installable': True,
    'application': False,
}