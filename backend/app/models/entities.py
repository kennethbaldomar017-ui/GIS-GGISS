import enum
import uuid
from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text, func, JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    admin = "admin"


class AccountStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    locked = "locked"


class Sex(str, enum.Enum):
    male = "male"
    female = "female"


class WazStatus(str, enum.Enum):
    severely_underweight = "severely_underweight"
    underweight = "underweight"
    normal = "normal"
    overweight = "overweight"


class HazStatus(str, enum.Enum):
    severely_stunted = "severely_stunted"
    stunted = "stunted"
    normal = "normal"
    tall = "tall"


class WhzStatus(str, enum.Enum):
    severely_wasted = "severely_wasted"
    wasted = "wasted"
    normal = "normal"
    overweight = "overweight"
    obese = "obese"


class OverallStatus(str, enum.Enum):
    severe_acute_malnutrition = "severe_acute_malnutrition"
    moderate_acute_malnutrition = "moderate_acute_malnutrition"
    normal = "normal"
    overweight = "overweight"


class AlertType(str, enum.Enum):
    severe_wasting = "severe_wasting"
    severe_stunting = "severe_stunting"
    severe_underweight = "severe_underweight"
    high_prevalence = "high_prevalence"
    deteriorating = "deteriorating"


class Severity(str, enum.Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class ReferralStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    completed = "completed"
    cancelled = "cancelled"


class Priority(str, enum.Enum):
    emergency = "emergency"
    urgent = "urgent"
    routine = "routine"


class ReportType(str, enum.Enum):
    monthly = "monthly"
    quarterly = "quarterly"
    annual = "annual"
    custom = "custom"
    program_activities = "program_activities"


class ReportStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    approved = "approved"
    rejected = "rejected"
    revision = "revision"


class NotificationType(str, enum.Enum):
    message = "message"
    report_submitted = "report_submitted"
    report_approved = "report_approved"
    report_rejected = "report_rejected"
    alert = "alert"
    info = "info"


class JobStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class ProgramFrequency(str, enum.Enum):
    weekly = "weekly"
    monthly = "monthly"


class ProgramStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    completed = "completed"


class ProgramType(str, enum.Enum):
    feeding_program = "Feeding Program"
    vitamin_supplementation = "Vitamin Supplementation"
    deworming = "Deworming"
    health_screening = "Health Screening"
    nutrition_education = "Nutrition Education"
    growth_monitoring = "Growth Monitoring"
    operation_timbang_plus = "Operation Timbang Plus"
    other = "Other"


class FundingSource(str, enum.Enum):
    city_funded = "City Funded Program"
    barangay_funded = "Barangay Funded Program"
    operation_timbang_plus = "Operation Timbang Plus Program"
    other = "Other"


class ActivityLogType(str, enum.Enum):
    child_created = "child_created"
    child_updated = "child_updated"
    measurement_added = "measurement_added"
    measurement_updated = "measurement_updated"
    referral_created = "referral_created"
    referral_updated = "referral_updated"
    program_session_created = "program_session_created"
    program_session_updated = "program_session_updated"
    participant_added = "participant_added"
    alert_resolved = "alert_resolved"
    report_generated = "report_generated"
    report_submitted = "report_submitted"
    auth = "auth"
    other = "other"


class CaseStatus(str, enum.Enum):
    active = "active"
    resolved = "resolved"
    transferred = "transferred"
    lost_to_followup = "lost_to_followup"


class CaseType(str, enum.Enum):
    sam = "sam"  # Severe Acute Malnutrition
    mam = "mam"  # Moderate Acute Malnutrition


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Barangay(Base):
    __tablename__ = "barangays"
    id = uuid_pk()
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    geometry: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    population_count: Mapped[int] = mapped_column(Integer, default=0)
    captain: Mapped[str | None] = mapped_column(String(120), nullable=True)
    nutrition_scholar: Mapped[str | None] = mapped_column(String(120), nullable=True)
    contact_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    puroks = relationship("Purok", back_populates="barangay")


class Purok(Base):
    __tablename__ = "puroks"
    id = uuid_pk()
    name: Mapped[str] = mapped_column(String(120), index=True)
    code: Mapped[str] = mapped_column(String(40), index=True)
    barangay_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("barangays.id"))
    geometry: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    leader: Mapped[str | None] = mapped_column(String(120), nullable=True)
    population: Mapped[int] = mapped_column(Integer, default=0)
    contact_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    assigned_bns: Mapped[str | None] = mapped_column(String(120), nullable=True)
    assigned_health_worker: Mapped[str | None] = mapped_column(String(120), nullable=True)
    household_count: Mapped[int] = mapped_column(Integer, default=0)
    barangay = relationship("Barangay", back_populates="puroks")


class User(Base, TimestampMixin):
    __tablename__ = "users"
    id = uuid_pk()
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.admin)
    barangay_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("barangays.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    account_status: Mapped[AccountStatus] = mapped_column(Enum(AccountStatus), default=AccountStatus.active)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_failed_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    account_locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    barangay = relationship("Barangay")


class Household(Base, TimestampMixin):
    __tablename__ = "households"
    id = uuid_pk()
    purok_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("puroks.id"))
    household_no: Mapped[str] = mapped_column(String(40))
    head_name: Mapped[str] = mapped_column(String(180))
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    member_count: Mapped[int] = mapped_column(Integer, default=0)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    purok = relationship("Purok")


class Child(Base, TimestampMixin):
    __tablename__ = "children"
    id = uuid_pk()
    full_name: Mapped[str] = mapped_column(String(180), index=True)
    birth_date: Mapped[date] = mapped_column(Date)
    sex: Mapped[Sex] = mapped_column(Enum(Sex))
    guardian_name: Mapped[str] = mapped_column(String(180))
    contact_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    purok_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("puroks.id"))
    barangay_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("barangays.id"))
    household_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("households.id"), nullable=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_indigenous: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    barangay = relationship("Barangay")
    purok = relationship("Purok")
    household = relationship("Household")
    measurements = relationship("Measurement", back_populates="child", cascade="all, delete-orphan")


class Measurement(Base):
    __tablename__ = "measurements"
    id = uuid_pk()
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id"))
    measured_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    measurement_date: Mapped[date] = mapped_column(Date, index=True)
    age_in_months: Mapped[int] = mapped_column(Integer)
    weight_kg: Mapped[float] = mapped_column(Float)
    height_cm: Mapped[float] = mapped_column(Float)
    muac_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    waz: Mapped[float] = mapped_column(Float)
    haz: Mapped[float] = mapped_column(Float)
    whz: Mapped[float] = mapped_column(Float)
    waz_status: Mapped[WazStatus] = mapped_column(Enum(WazStatus))
    haz_status: Mapped[HazStatus] = mapped_column(Enum(HazStatus))
    whz_status: Mapped[WhzStatus] = mapped_column(Enum(WhzStatus))
    overall_status: Mapped[OverallStatus] = mapped_column(Enum(OverallStatus))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    child = relationship("Child", back_populates="measurements")
    user = relationship("User")


class Alert(Base):
    __tablename__ = "alerts"
    id = uuid_pk()
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id"))
    measurement_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("measurements.id"), nullable=True)
    alert_type: Mapped[AlertType] = mapped_column(Enum(AlertType))
    severity: Mapped[Severity] = mapped_column(Enum(Severity))
    message: Mapped[str] = mapped_column(Text)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    child = relationship("Child")
    measurement = relationship("Measurement")


class Referral(Base):
    __tablename__ = "referrals"
    id = uuid_pk()
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id"))
    referred_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    referred_to: Mapped[str] = mapped_column(Text)
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[ReferralStatus] = mapped_column(Enum(ReferralStatus), default=ReferralStatus.pending)
    priority: Mapped[Priority] = mapped_column(Enum(Priority), default=Priority.routine)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    referred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    child = relationship("Child")


class Report(Base):
    __tablename__ = "reports"
    id = uuid_pk()
    title: Mapped[str] = mapped_column(String(220))
    report_type: Mapped[ReportType] = mapped_column(Enum(ReportType))
    barangay_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("barangays.id"), nullable=True)
    generated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    status: Mapped[ReportStatus] = mapped_column(Enum(ReportStatus), default=ReportStatus.draft)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)  # HTML content for shared editing
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_edited_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    last_edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Notification(Base):
    __tablename__ = "notifications"
    id = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType))
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    related_id: Mapped[str | None] = mapped_column(String(120), nullable=True)  # Related report/message ID
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    user = relationship("User")


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = uuid_pk()
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    barangay_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("barangays.id"), nullable=True)
    action_type: Mapped[ActivityLogType] = mapped_column(Enum(ActivityLogType), index=True)
    action: Mapped[str] = mapped_column(String(120), index=True)
    resource_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(80), nullable=True)
    is_notified: Mapped[bool] = mapped_column(Boolean, default=False)
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    user = relationship("User")
    barangay = relationship("Barangay")


class BulkImportJob(Base):
    __tablename__ = "bulk_import_jobs"
    id = uuid_pk()
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    file_name: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(500))
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.pending)
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    success_rows: Mapped[int] = mapped_column(Integer, default=0)
    error_rows: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ProjectBudget(Base, TimestampMixin):
    __tablename__ = "project_budgets"
    id = uuid_pk()
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    fiscal_year: Mapped[str] = mapped_column(String(20))  # e.g. "2025"
    label: Mapped[str | None] = mapped_column(String(120), nullable=True)  # e.g. "Annual Nutrition Budget"
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    creator = relationship("User", foreign_keys=[created_by])


class SystemSetting(Base):
    __tablename__ = "system_settings"
    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class NutritionProgram(Base, TimestampMixin):
    __tablename__ = "nutrition_programs"
    id = uuid_pk()
    name: Mapped[str] = mapped_column(String(220), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    program_type: Mapped[str] = mapped_column(String(50), default="Other")
    funding_source: Mapped[str] = mapped_column(String(50), default="City Funded Program")
    purok_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("puroks.id"))
    frequency: Mapped[ProgramFrequency] = mapped_column(Enum(ProgramFrequency))
    status: Mapped[ProgramStatus] = mapped_column(Enum(ProgramStatus), default=ProgramStatus.active)
    government_funded: Mapped[bool] = mapped_column(Boolean, default=False)
    budget_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_recommended_budget: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_recommendation_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approval_status: Mapped[str] = mapped_column(String(40), default="pending")  # pending, approved, revision, rejected
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    purok = relationship("Purok")

    sessions = relationship("ProgramSession", back_populates="program", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])


class ProgramSession(Base, TimestampMixin):
    __tablename__ = "program_sessions"
    id = uuid_pk()
    program_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nutrition_programs.id"))
    purok_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("puroks.id"))
    session_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    conducted_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_participants: Mapped[int] = mapped_column(Integer, default=0)
    program = relationship("NutritionProgram", back_populates="sessions")
    purok = relationship("Purok")
    participants = relationship("ProgramParticipant", back_populates="session", cascade="all, delete-orphan")
    conductor = relationship("User", foreign_keys=[conducted_by])


class ProgramParticipant(Base):
    __tablename__ = "program_participants"
    id = uuid_pk()
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("program_sessions.id"))
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id"))
    measurement_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("measurements.id"), nullable=True)
    attended: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    session = relationship("ProgramSession", back_populates="participants")
    child = relationship("Child")
    measurement = relationship("Measurement")


class HomeVisitStatus(str, enum.Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    missed = "missed"


class HomeVisit(Base, TimestampMixin):
    __tablename__ = "home_visits"
    id = uuid_pk()
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id"))
    scheduled_date: Mapped[date] = mapped_column(Date)
    scheduled_time: Mapped[str] = mapped_column(String(20))
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[HomeVisitStatus] = mapped_column(Enum(HomeVisitStatus), default=HomeVisitStatus.scheduled)
    findings: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendations: Mapped[str | None] = mapped_column(Text, nullable=True)
    gps_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    child = relationship("Child")
    assigned_user = relationship("User", foreign_keys=[assigned_to])


class MessageStatus(str, enum.Enum):
    sent = "sent"
    delivered = "delivered"
    read = "read"


class Message(Base, TimestampMixin):
    __tablename__ = "messages"
    id = uuid_pk()
    sender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    recipient_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    recipient_role: Mapped[str] = mapped_column(String(40), default="")  # "super_admin", "admin", or specific
    subject: Mapped[str] = mapped_column(String(220))
    content: Mapped[str] = mapped_column(Text)
    is_urgent: Mapped[bool] = mapped_column(Boolean, default=False)
    has_attachment: Mapped[bool] = mapped_column(Boolean, default=False)
    attachment_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    parent_message_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("messages.id"), nullable=True)
    status: Mapped[MessageStatus] = mapped_column(Enum(MessageStatus), default=MessageStatus.sent)
    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])
    replies = relationship("Message", remote_side=[id], backref="parent")


class CalendarEventType(str, enum.Enum):
    weighing = "weighing"
    feeding = "feeding"
    home_visit = "home_visit"
    training = "training"


class CalendarEvent(Base, TimestampMixin):
    __tablename__ = "calendar_events"
    id = uuid_pk()
    title: Mapped[str] = mapped_column(String(220))
    event_type: Mapped[CalendarEventType] = mapped_column(Enum(CalendarEventType))
    event_date: Mapped[date] = mapped_column(Date)
    time: Mapped[str] = mapped_column(String(20))
    location: Mapped[str] = mapped_column(String(255))
    purok_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("puroks.id"), nullable=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    purok = relationship("Purok")
    assigned_user = relationship("User", foreign_keys=[assigned_to])
    creator = relationship("User", foreign_keys=[created_by])


class LocationAccuracy(Base, TimestampMixin):
    """Track GIS accuracy for each barangay/purok"""
    __tablename__ = "location_accuracy"
    
    id = uuid_pk()
    barangay_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("barangays.id"))
    measurement_date: Mapped[date] = mapped_column(Date)
    
    # Counts
    expected_count: Mapped[int] = mapped_column(Integer)          # Manually verified children
    actual_count: Mapped[int] = mapped_column(Integer)            # System count
    accuracy_pct: Mapped[float] = mapped_column(Float)            # Calculated percentage
    is_reliable: Mapped[bool] = mapped_column(Boolean, default=False)  # True if >= 95%
    
    # Metadata
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)  # Why/how verified
    
    # Relationships
    barangay = relationship("Barangay")
    created_by = relationship("User")



class MalnutritionCase(Base, TimestampMixin):
    """
    Central case management entity for tracking malnutrition cases.
    Groups child measurements, interventions, and referrals.
    """
    __tablename__ = "malnutrition_cases"
    id = uuid_pk()
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id"), index=True)
    barangay_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("barangays.id"))
    case_status: Mapped[CaseStatus] = mapped_column(Enum(CaseStatus), default=CaseStatus.active, index=True)
    case_type: Mapped[CaseType] = mapped_column(Enum(CaseType), index=True)
    
    # Timeline
    enrollment_date: Mapped[date] = mapped_column(Date, server_default=func.now())
    first_measurement_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("measurements.id"), nullable=True)
    current_status_measurement_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("measurements.id"), nullable=True)
    resolution_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    
    # Assignment & Responsibility
    assigned_bns_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    responsible_facility: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    # Case Notes & Summary
    initial_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Relationships
    child = relationship("Child")
    barangay = relationship("Barangay")
    assigned_bns = relationship("User", foreign_keys=[assigned_bns_id])
    first_measurement = relationship("Measurement", foreign_keys=[first_measurement_id])
    current_measurement = relationship("Measurement", foreign_keys=[current_status_measurement_id])
    status_history = relationship("CaseStatusHistory", back_populates="case", cascade="all, delete-orphan")
    action_plans = relationship("CaseActionPlan", back_populates="case", cascade="all, delete-orphan")


class CaseStatusHistory(Base):
    """
    Audit trail of case status transitions.
    Tracks when and why a case status changed.
    """
    __tablename__ = "case_status_history"
    id = uuid_pk()
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("malnutrition_cases.id"), index=True)
    previous_status: Mapped[CaseStatus] = mapped_column(Enum(CaseStatus))
    new_status: Mapped[CaseStatus] = mapped_column(Enum(CaseStatus))
    changed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    case = relationship("MalnutritionCase", back_populates="status_history")
    changed_by_user = relationship("User", foreign_keys=[changed_by])


class CaseActionPlan(Base, TimestampMixin):
    """
    Action plan for a malnutrition case.
    Links planned interventions (referrals, programs, home visits) to the case.
    """
    __tablename__ = "case_action_plans"
    id = uuid_pk()
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("malnutrition_cases.id"), index=True)
    title: Mapped[str] = mapped_column(String(220))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    planned_interventions: Mapped[dict] = mapped_column(JSON, default=dict)  # e.g., {"referral": True, "program": True, "home_visits": 4}
    start_date: Mapped[date] = mapped_column(Date)
    expected_end_date: Mapped[date] = mapped_column(Date)
    expected_outcomes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    case = relationship("MalnutritionCase", back_populates="action_plans")
    creator = relationship("User", foreign_keys=[created_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class SecurityAlertType(str, enum.Enum):
    failed_login = "failed_login"
    account_locked = "account_locked"
    suspicious_activity = "suspicious_activity"
    permission_denied = "permission_denied"
    data_access_anomaly = "data_access_anomaly"


class SecurityAlert(Base, TimestampMixin):
    """Track suspicious security events for super admin monitoring"""
    __tablename__ = "security_alerts"
    id = uuid_pk()
    alert_type: Mapped[SecurityAlertType] = mapped_column(Enum(SecurityAlertType), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    username: Mapped[str] = mapped_column(String(80), nullable=True)  # Username for tracking even if user doesn't exist
    ip_address: Mapped[str] = mapped_column(String(45), nullable=True)  # Support IPv6
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str] = mapped_column(Text)
    details: Mapped[dict] = mapped_column(JSON, nullable=True)  # Additional context as JSON
    severity: Mapped[Severity] = mapped_column(Enum(Severity), default=Severity.medium)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    user = relationship("User", foreign_keys=[user_id], backref="security_alerts")
    resolver = relationship("User", foreign_keys=[resolved_by])
