using System;
using System.IO;
using System.Drawing;
using System.Drawing.Printing;
using System.Linq;
using System.Text;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

// Isolated renderer: only the supplied document and embedded data resources are available.
internal class DocumentWorker {
    public class Input {
        public string html, printer, mode;
        public double width, height;
    }
    const string DocumentUrl="https://print.hamnafas.invalid/document";
    [STAThread]
    static int Main() {
        Console.InputEncoding=new UTF8Encoding(false);
        var input=new JavaScriptSerializer { MaxJsonLength=12*1024*1024 }.Deserialize<Input>(Console.In.ReadToEnd());
        int result=1;
        using(var form=new Form { ShowInTaskbar=false, Opacity=0, Size=new Size(1024,768) })
        using(var view=new WebView2 { Dock=DockStyle.Fill }) {
            form.Controls.Add(view);
            form.Shown+=async delegate {
                try {
                    string cache=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"HamnafasLabel","webview");
                    var env=await CoreWebView2Environment.CreateAsync(null,cache);
                    await view.EnsureCoreWebView2Async(env);
                    var browser=view.CoreWebView2;
                    browser.Settings.IsScriptEnabled=false;
                    browser.Settings.IsWebMessageEnabled=false;
                    browser.Settings.AreHostObjectsAllowed=false;
                    browser.Settings.AreDefaultScriptDialogsEnabled=false;
                    browser.PermissionRequested+=(s,e)=>e.State=CoreWebView2PermissionState.Deny;
                    browser.NewWindowRequested+=(s,e)=>e.Handled=true;
                    browser.DownloadStarting+=(s,e)=>e.Cancel=true;
                    browser.LaunchingExternalUriScheme+=(s,e)=>e.Cancel=true;
                    browser.NavigationStarting+=(s,e)=>e.Cancel=e.Uri!=DocumentUrl;
                    browser.FrameNavigationStarting+=(s,e)=>e.Cancel=true;
                    browser.AddWebResourceRequestedFilter("*",CoreWebView2WebResourceContext.All);
                    browser.WebResourceRequested+=(s,e)=>{
                        bool allowed=e.Request.Uri==DocumentUrl && e.ResourceContext==CoreWebView2WebResourceContext.Document;
                        var bytes=allowed?Encoding.UTF8.GetBytes(input.html):new byte[0];
                        e.Response=env.CreateWebResourceResponse(new MemoryStream(bytes),allowed?200:403,allowed?"OK":"Forbidden",
                            "Content-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nContent-Security-Policy: default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'");
                    };
                    browser.NavigationCompleted+=async(s,e)=>{
                        try {
                            if(!e.IsSuccess)throw new IOException();
                            var settings=env.CreatePrintSettings();
                            settings.MediaSize=CoreWebView2PrintMediaSize.Custom;
                            settings.PageWidth=input.width/25.4;settings.PageHeight=input.height/25.4;
                            settings.MarginLeft=settings.MarginRight=settings.MarginTop=settings.MarginBottom=0;
                            settings.ShouldPrintBackgrounds=true;settings.ShouldPrintHeaderAndFooter=false;
                            if(input.mode=="pdf"){
                                using(var stream=await browser.PrintToPdfStreamAsync(settings))
                                using(var copy=new MemoryStream()){
                                    await stream.CopyToAsync(copy);
                                    if(copy.Length>0 && copy.Length<=20*1024*1024){Console.Write(Convert.ToBase64String(copy.ToArray()));result=0;}
                                }
                            }else{
                                var installed=new PrinterSettings {PrinterName=input.printer};
                                bool supportsSize=installed.IsValid && installed.PaperSizes.Cast<PaperSize>().Any(p=>
                                    Math.Abs(p.Width*0.254-input.width)<2 && Math.Abs(p.Height*0.254-input.height)<2);
                                if(!supportsSize)throw new ArgumentException("paper");
                                settings.PrinterName=input.printer;
                                if(await browser.PrintAsync(settings)==CoreWebView2PrintStatus.Succeeded)result=0;
                            }
                        }catch(ArgumentException){result=3;}catch(Exception){result=1;}finally{form.Close();}
                    };
                    browser.Navigate(DocumentUrl);
                }catch(Exception){form.Close();}
            };
            Application.Run(form);
        }
        return result;
    }
}
