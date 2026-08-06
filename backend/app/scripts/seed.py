import asyncio
import random
import re
from datetime import date, timedelta
from sqlalchemy import select

from app.database import AsyncSessionLocal, init_db
from app.models import Alert, Barangay, Child, Measurement, Purok, Referral, User, NutritionProgram
from app.models.entities import Priority, ReferralStatus, Sex, UserRole, ProgramFrequency, ProgramStatus

from app.services.alerts import alerts_for_measurement
from app.utils.security import hash_password
from app.utils.who_zscore import calculate_full_assessment


BARANGAY_DATA = {
    "Antonio Luna": {"pop": 1335, "coords": [9.0827,  125.5918]},
    "Bay-ang":      {"pop": 1580, "coords": [9.1033,  125.5779]},
    "Bayabas":      {"pop": 1573, "coords": [9.1451,  125.5940]},
    "Caasinan":     {"pop": 2016, "coords": [9.1365,  125.5233]},
    "Cabinet":      {"pop": 2130, "coords": [9.1269,  125.5268]},
    "Calamba":      {"pop": 2878, "coords": [9.0974,  125.6062]},
    "Calibunan":    {"pop": 4139, "coords": [9.1062,  125.5307]},
    "Comagascas":   {"pop": 4146, "coords": [9.1357,  125.5599]},
    "Concepcion":   {"pop": 1137, "coords": [9.1845,  125.5792]},
    "Del Pilar":    {"pop": 6181, "coords": [9.1527,  125.5827]},
    "Katugasan":    {"pop": 1485, "coords": [9.1316,  125.5875]},
    "Kauswagan":    {"pop": 3480, "coords": [9.1304,  125.5334]},
    "La Union":     {"pop": 7400, "coords": [9.0845,  125.5364]},
    "Mabini":       {"pop": 6661, "coords": [9.1141,  125.5517]},
    "Mahaba":       {"pop": 1724, "coords": [9.1032,  125.6315]},
    # Poblacion cluster spread in a 4x3 grid around city center
    "Poblacion 1":  {"pop": 1100, "coords": [9.1270,  125.5310]},
    "Poblacion 2":  {"pop": 980,  "coords": [9.1270,  125.5340]},
    "Poblacion 3":  {"pop": 1050, "coords": [9.1270,  125.5370]},
    "Poblacion 4":  {"pop": 1200, "coords": [9.1240,  125.5310]},
    "Poblacion 5":  {"pop": 1320, "coords": [9.1240,  125.5340]},
    "Poblacion 6":  {"pop": 1262, "coords": [9.1240,  125.5370]},
    "Poblacion 7":  {"pop": 2275, "coords": [9.1210,  125.5310]},
    "Poblacion 8":  {"pop": 362,  "coords": [9.1210,  125.5340]},
    "Poblacion 9":  {"pop": 3797, "coords": [9.1210,  125.5370]},
    "Poblacion 10": {"pop": 547,  "coords": [9.1180,  125.5310]},
    "Poblacion 11": {"pop": 552,  "coords": [9.1180,  125.5340]},
    "Poblacion 12": {"pop": 2471, "coords": [9.1180,  125.5370]},
    "Puting Bato":  {"pop": 3362, "coords": [9.1260,  125.6362]},
    "Sanghan":      {"pop": 3258, "coords": [9.0868,  125.5724]},
    "Soriano":      {"pop": 2170, "coords": [9.0984,  125.5645]},
    "Tolosa":       {"pop": 5998, "coords": [9.1199,  125.5261]},
}

def polygon_for(lat: float, lng: float):
    hw = 0.004
    hh = 0.004
    poly = {
        "type": "MultiPolygon",
        "coordinates": [[[[
            lng - hw, lat - hh
        ], [
            lng + hw, lat - hh
        ], [
            lng + hw, lat + hh
        ], [
            lng - hw, lat + hh
        ], [
            lng - hw, lat - hh
        ]]]]
    }
    return poly

async def main():
    print("Initializing DB...")
    await init_db()
    
    from sqlalchemy import text
    from app.database import engine, Base
    
    print("Checking for existing database tables...")
    should_drop = False
    async with engine.connect() as conn:
        try:
            def table_exists(sync_conn):
                return sync_conn.dialect.has_table(sync_conn, "users")

            if await conn.run_sync(table_exists):
                existing_res = await conn.execute(text("SELECT id FROM users WHERE username = 'superadmin'"))
                if existing_res.first():
                    should_drop = True
        except Exception as e:
            print(f"Error checking existing database: {e}")

    if should_drop:
        print("Existing database found. Dropping and recreating tables...")
        async with engine.connect() as conn:
            print("Terminating other database connections...")
            try:
                await conn.execute(text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'gishms' AND pid <> pg_backend_pid()"))
            except Exception as e:
                print(f"Warning: could not terminate other connections: {e}")
        
        async with engine.begin() as conn:
            print("Dropping all tables...")
            await conn.run_sync(Base.metadata.drop_all)
            print("Creating all tables...")
            await conn.run_sync(Base.metadata.create_all)
        print("Tables dropped and recreated.")
    else:
        print("No existing database needing drop/recreation.")

    print("Starting session to insert seed data...")
    async with AsyncSessionLocal() as db:
        barangays = []
        puroks = []
        for i, (name, data) in enumerate(BARANGAY_DATA.items()):
            lat, lng = data["coords"]
            geom = polygon_for(lat, lng)
            b = Barangay(name=name, code=f"BRGY-{i+1:02d}", geometry=geom, population_count=data["pop"])
            db.add(b)
            await db.flush()
            barangays.append((b, lat, lng))
            for p in range(1, 5):
                purok = Purok(name=f"Purok {p}", code=f"{b.code}-P{p}", barangay_id=b.id)
                db.add(purok)
                puroks.append(purok)

        superadmin = User(username="superadmin", email="superadmin@example.com", password_hash=hash_password("Admin@123"), role=UserRole.super_admin)
        db.add(superadmin)
        await db.flush()
        for (barangay, _, _) in barangays:
            slug = re.sub(r"[^a-z0-9]+", "_", barangay.name.lower()).strip("_")
            username = f"admin_{slug}"
            email = f"{username}@gishms.local"
            db.add(User(username=username, email=email, password_hash=hash_password("Admin@123"), role=UserRole.admin, barangay_id=barangay.id))
        await db.flush()

        all_puroks = list((await db.scalars(select(Purok))).all())
        names = ["Ana", "Ben", "Carla", "Dino", "Ella", "Finn", "Gina", "Hugo", "Iris", "Joel"]
        for i in range(50):
            barangay, lat, lng = random.choice(barangays)
            p = random.choice([x for x in all_puroks if x.barangay_id == barangay.id])
            birth = date(2024, 1, 1) + timedelta(days=random.randint(180, 60 * 30))
            child = Child(
                full_name=f"{random.choice(names)} Sample {i+1}",
                birth_date=birth,
                sex=random.choice([Sex.male, Sex.female]),
                guardian_name=f"Guardian {i+1}",
                contact_number="09" + "".join(random.choice("0123456789") for _ in range(9)),
                purok_id=p.id,
                barangay_id=barangay.id,
                latitude=lat + random.uniform(-0.005, 0.005),
                longitude=lng + random.uniform(-0.005, 0.005),
            )
            db.add(child)
            await db.flush()
            for n in range(3):
                # Create 2024 measurements: Sept, July, May 2024
                mdate = date(2024, 9, 15) - timedelta(days=n * 60)
                age = max(1, (mdate.year - birth.year) * 12 + mdate.month - birth.month)
                malnourished = i % 5 == 0 or i % 3 == 0
                height = 52 + age * 1.05 + random.uniform(-3, 3)
                weight = 3.5 + age * 0.25 + random.uniform(-1, 1)
                if malnourished:
                    weight *= 0.72 if i % 5 == 0 else 0.84
                assessment = calculate_full_assessment(child.sex.value, age, weight, height)
                m = Measurement(child_id=child.id, measured_by=superadmin.id, measurement_date=mdate, age_in_months=age, weight_kg=round(weight, 2), height_cm=round(height, 1), muac_cm=round(random.uniform(10, 15), 1), **assessment)
                db.add(m)
                await db.flush()
            for alert in alerts_for_measurement(child, m):
                db.add(alert)
                if alert.severity.value in {"critical", "high"}:
                    db.add(Referral(child_id=child.id, referred_by=superadmin.id, referred_to="Cabadbaran City Health Office", reason=alert.message, status=ReferralStatus.pending, priority=Priority.urgent))
        
        # Seed some nutrition programs with different approval statuses
        if puroks:
            p1 = NutritionProgram(
                name="Supplementary Feeding Program",
                description="Daily supplementary feeding program for underweight children",
                purok_id=puroks[0].id,
                frequency=ProgramFrequency.weekly,
                status=ProgramStatus.active,
                government_funded=True,
                budget_amount=50000.0,
                created_by=superadmin.id,
                approval_status="approved",
                comments="Approved by City Nutrition Action Officer."
            )
            p2 = NutritionProgram(
                name="Vitamin A Supplementation",
                description="Semiannual Vitamin A supplementation capsule distribution",
                purok_id=puroks[1].id,
                frequency=ProgramFrequency.monthly,
                status=ProgramStatus.active,
                government_funded=False,
                budget_amount=15000.0,
                created_by=superadmin.id,
                approval_status="pending"
            )
            p3 = NutritionProgram(
                name="Barangay Milk Feeding",
                description="Mass deworming and milk distribution for children",
                purok_id=puroks[2].id,
                frequency=ProgramFrequency.monthly,
                status=ProgramStatus.active,
                government_funded=True,
                budget_amount=8000.0,
                created_by=superadmin.id,
                approval_status="revision",
                comments="Please adjust the budget breakdown and target child list."
            )
            db.add_all([p1, p2, p3])
            await db.flush()

        await db.commit()

        print("Seed complete.")
        print("Super Admin  -> username: superadmin         | password: Admin@123")
        print("Barangay Admins (password: Admin@123):")
        for (barangay, _, _) in barangays:
            slug = re.sub(r"[^a-z0-9]+", "_", barangay.name.lower()).strip("_")
            print(f"  {barangay.name:<20} -> admin_{slug}")


if __name__ == "__main__":
    asyncio.run(main())
