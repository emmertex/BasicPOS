from . import db
from sqlalchemy.orm import relationship

class Category(db.Model):
    __tablename__ = 'Categories'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, unique=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('Categories.id'), nullable=True)
    
    items = relationship("Item", back_populates="category")
    parent = relationship("Category", remote_side=[id], back_populates="children")
    children = relationship("Category", back_populates="parent")

    def __repr__(self):
        return f'<Category {self.name}>'

class Item(db.Model):
    __tablename__ = 'Items'
    id = db.Column(db.Integer, primary_key=True)
    parent_id = db.Column(db.Integer) # For versioning, might not be directly used in frontend
    is_current_version = db.Column(db.Boolean, nullable=False, default=True)
    sku = db.Column(db.String(255))
    stock_quantity = db.Column(db.Integer, nullable=False, default=0)
    is_stock_tracked = db.Column(db.Boolean, nullable=False, default=True)
    title = db.Column(db.String(2048), nullable=False)
    description = db.Column(db.Text)
    price = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    show_on_website = db.Column(db.Boolean, nullable=False, default=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    category_id = db.Column(db.Integer, db.ForeignKey('Categories.id'), nullable=True)

    category = relationship("Category", back_populates="items")
    photos = relationship("Photo", back_populates="item", lazy='dynamic') # Use lazy='dynamic' for photos

    def __repr__(self):
        return f'<Item {self.title}>'

class Photo(db.Model):
    __tablename__ = 'Photos'
    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(db.Integer, db.ForeignKey('Items.id'), nullable=False)
    image_url = db.Column(db.String(255), nullable=False)
    is_primary = db.Column(db.Boolean, nullable=False, default=False)

    item = relationship("Item", back_populates="photos")

    def __repr__(self):
        return f'<Photo {self.image_url}>'

# Note: Customers, Sales, SaleItems, Payments, QuickAddItems are not included here
# as the request focuses on displaying items and categories on the website.
# If any part of these is needed (e.g., for related product logic, though unlikely for read-only display),
# they can be added. 