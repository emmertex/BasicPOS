from app import db
from sqlalchemy.sql import func
from sqlalchemy import Enum as SQLAlchemyEnum

class Sale(db.Model):
    __tablename__ = 'sales'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    status = db.Column(SQLAlchemyEnum('Open', 'Quote', 'Invoice', 'Paid', 'Void', name='sale_status_enum'), nullable=False, default='Open')
    
    # Overall discount fields
    overall_discount_type = db.Column(
        SQLAlchemyEnum('none', 'percentage', 'fixed', 'target_total', name='overall_discount_type_enum'), 
        default='none', 
        nullable=False
    )
    overall_discount_value = db.Column(db.Numeric(10, 2), default=0.00, nullable=False)
    overall_discount_amount_applied = db.Column(db.Numeric(10, 2), default=0.00, nullable=False)
    transaction_fee = db.Column(db.Numeric(10, 2), default=0.00, nullable=False)

    created_at = db.Column(db.TIMESTAMP, server_default=func.now())
    updated_at = db.Column(db.TIMESTAMP, server_default=func.now(), onupdate=func.now())
    customer_notes = db.Column(db.Text, nullable=True)
    internal_notes = db.Column(db.Text, nullable=True)
    purchase_order_number = db.Column(db.String(100), nullable=True)

    sale_items = db.relationship('SaleItem', backref='sale', lazy=True, cascade='all, delete-orphan')
    payments = db.relationship('Payment', backref='sale', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Sale {self.id} Status: {self.status}>' 