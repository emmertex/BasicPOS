from app import db

class Item(db.Model):
    __tablename__ = 'items'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    parent_id = db.Column(db.Integer, nullable=True) # -1: no parent, -2: is a parent, >0: Items.id of parent
    is_current_version = db.Column(db.Boolean, nullable=False, default=True)
    sku = db.Column(db.String(255), unique=True, nullable=False)
    stock_quantity = db.Column(db.Integer, nullable=False, default=0)
    is_stock_tracked = db.Column(db.Boolean, nullable=False, default=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    show_on_website = db.Column(db.Boolean, nullable=False, default=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)

    photos = db.relationship('Photo', backref='item', lazy=True, cascade='all, delete-orphan')
    sale_items = db.relationship('SaleItem', backref='item', lazy=True)

    def __repr__(self):
        return f'<Item {self.sku} {self.title}>' 