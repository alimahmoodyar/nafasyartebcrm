"""Confirm that a newly launched bridge actually created its window."""
import json
import time

def wait_for_window(process, ready_file, timeout=30):
    deadline=time.monotonic()+timeout
    while time.monotonic()<deadline:
        code=process.poll()
        if code is not None:
            raise RuntimeError('The bridge exited before its window was confirmed (exit '+str(code)+'). See START-LOG.txt.')
        if ready_file.exists():
            try:status=json.loads(ready_file.read_text(encoding='utf-8'))
            except (OSError,ValueError):status={}
            if status.get('status')=='error':
                raise RuntimeError('The bridge could not open: '+str(status.get('message','Unknown startup error'))+'. See START-LOG.txt.')
            if status.get('status')=='window-visible' and status.get('pid')==process.pid:
                return status
        time.sleep(0.05)
    raise RuntimeError('The bridge window was not confirmed within '+str(timeout)+' seconds. See START-LOG.txt.')
