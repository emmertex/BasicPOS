from app import db
from sqlalchemy.orm import relationship

class Category(db.Model):
    __tablename__ = 'categories'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(255), nullable=False, unique=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)

    children = relationship("Category",
                            backref=db.backref('parent', remote_side=[id]),
                            lazy='dynamic')
    items = db.relationship('Item', backref='category', lazy='dynamic')

    def __repr__(self):
        return f'<Category {self.name}>' 