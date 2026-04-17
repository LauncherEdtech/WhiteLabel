# api/app/models/notification.py
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from .base import BaseModel, TenantMixin


class Notification(BaseModel, TenantMixin):
    """
    Notificações in-platform enviadas pelo infoprodutor para seus alunos.
    Cada aluno recebe seu próprio registro — permite rastrear leitura individualmente.
    """

    __tablename__ = "notifications"

    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)

    # "broadcast" = enviado para todos os alunos do tenant
    # "direct"    = enviado para um aluno específico (futuro)
    notification_type = Column(String(50), default="broadcast", nullable=False)

    # Quem enviou (producer_admin / producer_staff)
    sender_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)

    # Destinatário individual (cada aluno tem seu próprio registro)
    recipient_id = Column(
        UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, index=True
    )

    is_read = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)

    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])

    __table_args__ = (
        # Index composto para a query mais comum: notificações não lidas de um usuário
        Index("ix_notifications_recipient_unread", "recipient_id", "is_read"),
    )

    def mark_read(self):
        self.is_read = True
        self.read_at = datetime.now(timezone.utc)

    def __repr__(self):
        return f"<Notification {self.title!r} → {self.recipient_id}>"