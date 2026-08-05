import traceback
from database import SessionLocal
from services.matching_job import run_matching
import models

db = SessionLocal()
run = db.query(models.MatchingRun).order_by(models.MatchingRun.id.desc()).first()
if run:
    try:
        run_matching(run.id, run.session_id, run.seed, db)
        print("Success! Log:")
        print(run.log)
    except Exception as e:
        traceback.print_exc()
else:
    print("No runs found.")
