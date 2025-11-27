{
    'name': 'CastroLi Credit Limit Block',
    'version': '18.0.1.0.1',
    'summary': 'Bloquea pedidos que superen el límite de crédito y permite aprobación solo a administradores',
    'category': 'Accounting',
    'author': 'CastroLi S.A.',
    'website': 'https://castroli.cr',
    'depends': ['sale_management', 'account'],
    'data': [
        'views/sale_order_view_credit.xml',
    ],
    'license': 'LGPL-3',
    'installable': True,
    'application': False,
}