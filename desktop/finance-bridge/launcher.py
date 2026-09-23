import os, sys, threading, tkinter as tk, webbrowser, json, pathlib, queue
from tkinter import messagebox
from bridge import Session, BridgeServer, ORIGIN, VERSION

def main(on_ready=None):
    if sys.platform!='win32':raise SystemExit('Windows 10/11 is required.')
    root=tk.Tk();root.title('Nafasyar Windows Bridge '+VERSION);root.geometry('680x490');root.minsize(640,470)
    state={'server':None,'session':None};status=tk.StringVar(value='Stopped / قطع');token=tk.StringVar()
    tk.Label(root,text='رابط ویندوز نفس‌یار — فقط مشاهده',font=('Segoe UI',17)).pack(pady=18)
    tk.Label(root,text='حسابداری را باز کنید؛ در سامانه نفس‌یار وارد «اتصال حسابداری» شوید.',font=('Segoe UI',11),wraplength=600).pack()
    tk.Label(root,textvariable=status,fg='#414a9c',font=('Segoe UI',12)).pack(pady=10)
    tk.Label(root,text='کد اتصال همین نشست').pack()
    tk.Entry(root,textvariable=token,state='readonly',justify='center',width=66).pack(pady=8)
    def start():
        if state['server']:return
        try:
            import psutil, PIL, pythoncom
            session=Session();server=BridgeServer(session)
        except Exception as e:
            messagebox.showerror('Start failed','رابط شروع نشد. اگر نسخه قبلی باز است، آن را ببندید.\n'+str(e));return
        def run():
            sys.coinit_flags=0
            pythoncom.CoInitializeEx(pythoncom.COINIT_MULTITHREADED)
            try:server.serve_forever(poll_interval=0.2)
            finally:server.server_close();pythoncom.CoUninitialize()
        state.update(server=server,session=session);threading.Thread(target=run,daemon=True).start();token.set(session.token);status.set('Active — read only / فعال، فقط مشاهده')
    def stop():
        server=state['server']
        if server:
            state['session'].created=0
            threading.Thread(target=server.shutdown,daemon=True).start();state.update(server=None,session=None)
        token.set('');status.set('Stopped / قطع')
    def copy():
        if token.get():root.clipboard_clear();root.clipboard_append(token.get());root.update()
    buttons=tk.Frame(root);buttons.pack(pady=12)
    for label,fn in [('شروع اتصال',start),('کپی کد',copy),('بازکردن سامانه',lambda:webbrowser.open(ORIGIN)),('قطع اتصال',stop)]:tk.Button(buttons,text=label,command=fn,padx=10,pady=6).pack(side='right',padx=5)
    tk.Label(root,text='خواندن فقط با درخواست شما • بدون ثبت سند • بدون اجرای خودکار روزانه',font=('Segoe UI',10)).pack(pady=8)
    diagnostics={'text':''};completed=queue.Queue()
    diag_status=tk.StringVar(value='اگر پنجره‌ها پیدا نمی‌شوند، عیب‌یابی را بزنید؛ اتصال سایت لازم نیست.')
    def diagnostic_worker():
        try:
            from diagnose import collect
            report=collect();text=json.dumps(report,ensure_ascii=False,indent=2)
            try:(pathlib.Path(__file__).resolve().parent/'DIAGNOSTICS.json').write_text(text,encoding='utf-8')
            except OSError:pass
            completed.put((text,None))
        except Exception as exc:completed.put(('',type(exc).__name__))
    def finish_diagnostics():
        try:text,error=completed.get_nowait()
        except queue.Empty:root.after(150,finish_diagnostics);return
        diagnostic_button.config(state='normal')
        if error:diag_status.set('عیب‌یابی اجرا نشد: '+error);return
        diagnostics['text']=text;copy_diagnostic.config(state='normal')
        report=json.loads(text)
        diag_status.set(' | '.join(item['backend'].upper()+': '+str(item.get('accepted',0))+' پنجره ('+item['status']+')' for item in report['results'])+'\nگزارش را کپی کنید و در گفتگو بفرستید.')
    def run_diagnostics():
        diagnostic_button.config(state='disabled');copy_diagnostic.config(state='disabled')
        diag_status.set('در حال بررسی هر دو روش؛ حداکثر حدود ۴۰ ثانیه…')
        threading.Thread(target=diagnostic_worker,daemon=True).start();root.after(150,finish_diagnostics)
    def copy_diagnostics():
        root.clipboard_clear();root.clipboard_append(diagnostics['text']);root.update()
    diag_buttons=tk.Frame(root);diag_buttons.pack(pady=8)
    diagnostic_button=tk.Button(diag_buttons,text='عیب‌یابی پنجره‌ها',command=run_diagnostics,padx=10);diagnostic_button.pack(side='right',padx=5)
    copy_diagnostic=tk.Button(diag_buttons,text='کپی گزارش عیب‌یابی',command=copy_diagnostics,state='disabled',padx=10);copy_diagnostic.pack(side='right',padx=5)
    tk.Label(root,textvariable=diag_status,wraplength=630,justify='center',font=('Segoe UI',10)).pack()
    def report_callback_error(kind,value,tb):
        import traceback
        traceback.print_exception(kind,value,tb)
        messagebox.showerror('Nafasyar Bridge',str(value)+'\nSee START-LOG.txt in the application folder.')
    root.report_callback_exception=report_callback_error
    def visible():
        if not root.winfo_viewable():root.after(100,visible);return
        root.lift()
        if on_ready:on_ready()
    root.after(200,visible)
    root.protocol('WM_DELETE_WINDOW',lambda:(stop(),root.destroy()));root.mainloop()
if __name__=='__main__':main()
