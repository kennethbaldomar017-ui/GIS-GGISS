"""
Script to delete all Operation Timbang measurement records for a given barangay name.
Use with care. Run from the repository root:

python backend/scripts/delete_by_barangay.py "Poblacion 8"

This script will only delete rows from the `measurements` table for children assigned to the specified barangay.
It does NOT delete child records or other resources.
"""
import sys
import asyncio
from sqlalchemy import select, delete
from app.database import AsyncSessionLocal
from app.models.entities import Barangay, Child, Measurement


async def delete_measurements_for_barangay(barangay_name: str):
    async with AsyncSessionLocal() as session:
        # Find barangay
        stmt = select(Barangay).where(Barangay.name == barangay_name)
        result = await session.execute(stmt)
        barangay = result.scalar_one_or_none()
        if not barangay:
            print(f"Barangay not found: {barangay_name}")
            return

        # Get child IDs in barangay
        stmt_children = select(Child.id).where(Child.barangay_id == barangay.id)
        res_children = await session.execute(stmt_children)
        child_ids = [row[0] for row in res_children.all()]

        if not child_ids:
            print(f"No children found for barangay '{barangay_name}'. Nothing to delete.")
            return

        print(f"Found {len(child_ids)} children in '{barangay_name}'. Deleting measurements...")

        # Delete measurements for these children
        del_stmt = delete(Measurement).where(Measurement.child_id.in_(child_ids))
        result = await session.execute(del_stmt)
        deleted = result.rowcount if result.rowcount is not None else 'unknown'

        await session.commit()
        print(f"Deleted {deleted} measurement(s) for barangay '{barangay_name}'")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python backend/scripts/delete_by_barangay.py \"Poblacion 8\"")
        sys.exit(1)

    barangay = sys.argv[1]
    asyncio.run(delete_measurements_for_barangay(barangay))
