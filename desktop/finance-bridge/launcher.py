import os, sys, threading, tkinter as tk, webbrowser
from tkinter import messagebox
from bridge import Session, BridgeServer, ORIGIN, VERSION

def main():
    if sys.platform!='win32':raise SystemExit('Windows 10/11 is required.')
    root=tk.Tk();root.title('Nafasyar Windows Bridge '+VERSION);root.geometry('650x360');root.minsize(600,350)
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
            sys.coinit_flags=2
            pythoncom.CoInitialize()
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
    root.protocol('WM_DELETE_WINDOW',lambda:(stop(),root.destroy()));root.mainloop()
if __name__=='__main__':main()
