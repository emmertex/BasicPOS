# This file makes the 'models' directory a Python package 

# Import models here to make them accessible via db.Model
# Models will import 'db' from the main 'app' package
from .item import Item
from .photo import Photo
from .customer import Customer
from .sale import Sale
from .sale_item import SaleItem
from .payment import Payment
from .quick_add_item import QuickAddItem
from .category import Category
from .combination import CombinationItem, CombinationItemComponent

__all__ = [
    'Item',
    'Photo',
    'Customer',
    'Sale',
    'SaleItem',
    'Payment',
    'QuickAddItem',
    'Category',
    'CombinationItem',
    'CombinationItemComponent'
] 