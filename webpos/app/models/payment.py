from app import db
from sqlalchemy.sql import func

class Payment(db.Model):
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    sale_id = db.Column(db.Integer, db.ForeignKey('sales.id'), nullable=False)
    payment_type = db.Column(db.String(50), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    payment_date = db.Column(db.TIMESTAMP, server_default=func.now())
    payment_details = db.Column(db.Text, nullable=True)  # Store additional payment details like Tyro transaction info

    # The relationship to Sale is already defined in the Sale model as 'payments'

    def __repr__(self):
        return f'<Payment {self.id} for Sale {self.sale_id} Amount: {self.amount}>' 