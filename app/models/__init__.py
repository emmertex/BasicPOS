# This file makes the 'models' directory a Python package 

# Import models here to make them accessible via db.Model
# Models will import 'db' from the main 'app' package
from .customer import Customer
from .item import Item
from .photo import Photo
from .sale import Sale
from .sale_item import SaleItem
from .payment import Payment
from .quick_add_item import QuickAddItem

__all__ = [
    'Customer',
    'Item',
    'Photo',
    'Sale',
    'SaleItem',
    'Payment',
    'QuickAddItem'
] 