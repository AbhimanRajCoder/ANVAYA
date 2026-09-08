import logging
import sys
from datetime import datetime, timezone, timedelta

# Indian Standard Time (IST: UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

class ISTFormatter(logging.Formatter):
    def formatTime(self, record, datefmt=None):
        dt = datetime.fromtimestamp(record.created, tz=IST)
        if datefmt:
            return dt.strftime(datefmt)
        return dt.strftime("%Y-%m-%d %H:%M:%S")

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(ISTFormatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))

logging.basicConfig(
    level=logging.INFO,
    handlers=[handler]
)

logger = logging.getLogger("anavya")

