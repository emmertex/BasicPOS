from app import db
from sqlalchemy.sql import func

class Sale(db.Model):
    __tablename__ = 'Sales'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('Customers.id'), nullable=True)
    status = db.Column(db.Enum('Open', 'Quote', 'Invoice', 'Paid', 'Void', name='sale_status_enum'), nullable=False, default='Open')
    created_at = db.Column(db.TIMESTAMP, server_default=func.now())
    updated_at = db.Column(db.TIMESTAMP, server_default=func.now(), onupdate=func.now())
    customer_notes = db.Column(db.Text, nullable=True)
    internal_notes = db.Column(db.Text, nullable=True)
    purchase_order_number = db.Column(db.String(100), nullable=True)

    sale_items = db.relationship('SaleItem', backref='sale', lazy=True, cascade='all, delete-orphan')
    payments = db.relationship('Payment', backref='sale', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Sale {self.id} Status: {self.status}>' 