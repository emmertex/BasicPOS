from app import db
from sqlalchemy.sql import func

class Payment(db.Model):
    __tablename__ = 'Payments'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    sale_id = db.Column(db.Integer, db.ForeignKey('Sales.id'), nullable=False)
    payment_type = db.Column(db.String(50), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    payment_date = db.Column(db.TIMESTAMP, server_default=func.now())

    # The relationship to Sale is already defined in the Sale model as 'payments'

    def __repr__(self):
        return f'<Payment {self.id} for Sale {self.sale_id} Amount: {self.amount}>' 