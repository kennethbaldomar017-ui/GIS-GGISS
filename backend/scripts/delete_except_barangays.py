"""
Delete Operation Timbang measurements for all barangays except those listed.

Usage (dry-run only):
python backend/scripts/delete_except_barangays.py --keep "Tolosa" "Poblacion 8"

To perform deletion, add --confirm flag:
python backend/scripts/delete_except_barangays.py --keep "Tolosa" "Poblacion 8" --confirm

This script only deletes rows from the `measurements` table for children whose `barangay` is NOT in the keep list.
It does NOT delete `children`, `households`, or other related records.
"""
import argparse
import asyncio
from sqlalchemy import select, delete, func
from app.database import AsyncSessionLocal
from app.models.entities import Barangay, Child, Measurement


async def run(keep_names, do_confirm=False):
    # Normalize keep names
    keep_norm = [n.strip().lower() for n in keep_names]

    async with AsyncSessionLocal() as session:
        # Find barangays to keep
        stmt = select(Barangay).where(func.lower(Barangay.name).in_(keep_norm))
        res = await session.execute(stmt)
        keep_barangays = res.scalars().all()
        keep_ids = [b.id for b in keep_barangays]

        print(f"Keep barangays (found): {[b.name for b in keep_barangays]}")

        # Find all barangays that will be deleted (names not in keep list)
        stmt_all = select(Barangay)
        res_all = await session.execute(stmt_all)
        all_barangays = res_all.scalars().all()
        delete_barangays = [b for b in all_barangays if b.id not in keep_ids]
        print(f"Barangays to remove data from: {[b.name for b in delete_barangays]}")

        if not delete_barangays:
            print("No barangays to delete from. Exiting.")
            return

        delete_barangay_ids = [b.id for b in delete_barangays]

        # Get children in delete barangays
        stmt_children = select(Child.id).where(Child.barangay_id.in_(delete_barangay_ids))
        res_children = await session.execute(stmt_children)
        child_ids = [row[0] for row in res_children.all()]

        print(f"Found {len(child_ids)} children in target barangays.")

        if not child_ids:
            print("No children found in target barangays. Nothing to delete.")
            return

        # Count measurements to be deleted
        stmt_count = select(func.count(Measurement.id)).where(Measurement.child_id.in_(child_ids))
        res_count = await session.execute(stmt_count)
        to_delete_count = res_count.scalar_one()
        print(f"Measurements to delete: {to_delete_count}")

        if not do_confirm:
            print("Dry run: no data will be deleted. To perform deletion, re-run with --confirm flag.")
            return

        # Perform deletion
        del_stmt = delete(Measurement).where(Measurement.child_id.in_(child_ids))
        result = await session.execute(del_stmt)
        deleted = result.rowcount if result.rowcount is not None else 'unknown'
        await session.commit()

        print(f"Deleted {deleted} measurements from barangays excluding {keep_names}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Delete OPT+ measurements except for specified barangays')
    parser.add_argument('--keep', nargs='+', required=True, help='Barangay names to keep (e.g. "Tolosa" "Poblacion 8")')
    parser.add_argument('--confirm', action='store_true', help='Required to actually perform deletion')
    args = parser.parse_args()

    asyncio.run(run(args.keep, do_confirm=args.confirm))
