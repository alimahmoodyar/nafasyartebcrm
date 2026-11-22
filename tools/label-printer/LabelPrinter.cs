using System;
using System.Collections.Generic;
using System.Globalization;
using System.Diagnostics;
using System.Windows.Forms;
using Microsoft.Win32;
using System.Reflection;
using System.IO;
using System.Linq;
using System.Management;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;

[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

internal class LabelPrinter {
    const string Origin = "https://newcrm.nafasyar.com";
    const int Limit = 12 * 1024 * 1024;
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = Limit };
    static readonly string Claims = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HamnafasLabel", "jobs");

    public class Job {
        public string id, printer;
        public int width, height;
        public string[] pages;
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    class DocInfo {
        public string name = "Hamnafas label", output = null, type = "RAW";
    }
    [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
    [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern int StartDocPrinter(IntPtr handle, int level, [In] DocInfo doc);
    [DllImport("winspool.drv", SetLastError=true)]
    static extern bool WritePrinter(IntPtr handle, byte[] data, int size, out int written);
    [DllImport("winspool.drv")] static extern bool EndDocPrinter(IntPtr handle);
    [DllImport("winspool.drv")] static extern bool AbortPrinter(IntPtr handle);
    [DllImport("winspool.drv")] static extern bool ClosePrinter(IntPtr handle);

    static string[] Printers() {
        using (var query = new ManagementObjectSearcher("SELECT Name, DriverName FROM Win32_Printer"))
        using (var result = query.Get()) {
            return result.Cast<ManagementObject>().Where(p => String.Equals(Convert.ToString(p["DriverName"]), "Godex G500", StringComparison.OrdinalIgnoreCase)).Select(p => Convert.ToString(p["Name"])).ToArray();
        }
    }
    internal static byte[] Encode(Job j) {
        Guid id;
        if (j == null || !Guid.TryParseExact(j.id, "D", out id) || j.width < 1 || j.width > 864 || j.height < 32 || j.height > 4000 || j.pages == null || j.pages.Length < 1 || j.pages.Length > 500) throw new ArgumentException();
        int stride = (j.width + 7) / 8;
        int size = stride * j.height;
        var commands = new StringBuilder();
        foreach (string page in j.pages) {
            if (page == null || page.Length != 2 * size || page.Any(c => !(c >= '0' && c <= '9' || c >= 'A' && c <= 'F'))) throw new ArgumentException();
            commands.AppendFormat(CultureInfo.InvariantCulture,"^XA^MNY^PON^LH0,0^LT0^LS0^PW{0}^LL{1}^FO0,0^GFA,{2},{2},{3},{4}^FS^PQ1^XZ\r\n", j.width,j.height,size,stride,page);
        }
        return Encoding.ASCII.GetBytes(commands.ToString());
    }
    static void Submit(Job job, byte[] data) {
        if (!Printers().Contains(job.printer)) throw new ArgumentException();
        IntPtr h;
        if (!OpenPrinter(job.printer,out h,IntPtr.Zero)) throw new IOException();
        try {
            string key = Path.Combine(Claims, Guid.Parse(job.id).ToString("D"));
            // Claim before spooling. A lost response must never enqueue a second copy.
            using (new FileStream(key,FileMode.CreateNew,FileAccess.Write,FileShare.None)) {}
            if (StartDocPrinter(h,1,new DocInfo()) == 0) throw new IOException();
            int written;
            if (!WritePrinter(h,data,data.Length,out written) || written != data.Length) { AbortPrinter(h); throw new IOException(); }
            if (!EndDocPrinter(h)) throw new IOException();
        } finally { ClosePrinter(h); }
    }
    static void Reply(HttpListenerResponse r,int status,object value) {
        byte[] bytes=Encoding.UTF8.GetBytes(Json.Serialize(value));
        r.StatusCode=status; r.ContentType="application/json"; r.ContentLength64=bytes.Length;
        r.OutputStream.Write(bytes,0,bytes.Length);
    }
    static void Handle(HttpListenerContext c) {
        var r=c.Response; var q=c.Request;
        if(q.Headers["Origin"] != Origin || q.UserHostName != "127.0.0.1:18742") { Reply(r,403,false);return; }
        r.Headers["Access-Control-Allow-Origin"]=Origin;
        r.Headers["Cache-Control"]="no-store";
        if(q.HttpMethod=="OPTIONS") {
            r.Headers["Access-Control-Allow-Methods"]="POST";
            r.Headers["Access-Control-Allow-Headers"]="Content-Type";
            r.Headers["Access-Control-Allow-Private-Network"]="true";
            r.StatusCode=204;return;
        }
        if(q.HttpMethod!="POST" || q.ContentType!="application/json") { Reply(r,415,false);return; }
        if(q.Url.AbsolutePath=="/printers") { Reply(r,200,new { printers=Printers(), version=Version });return; }
        if(q.Url.AbsolutePath!="/jobs") { Reply(r,404,false);return; }
        if(q.ContentLength64<1 || q.ContentLength64>Limit) { Reply(r,413,false);return; }
        using(var reader=new StreamReader(q.InputStream, Encoding.UTF8)) {
            var job=Json.Deserialize<Job>(reader.ReadToEnd());
            var data=Encode(job);
            Submit(job,data);
        }
        Reply(r,200,new { queued=true });
    }
    const string Version = "1.0.0";
    static void Install() {
        string folder=Path.GetDirectoryName(Claims);
        Directory.CreateDirectory(folder);
        string target=Path.Combine(folder,"HamnafasLabel-"+Version+".exe");
        string source=Assembly.GetExecutingAssembly().Location;
        bool running=Process.GetProcessesByName(Path.GetFileNameWithoutExtension(target))
            .Any(p=>String.Equals(p.MainModule.FileName,target,StringComparison.OrdinalIgnoreCase));
        if(!running) File.Copy(source,target,true);
        using(var run=Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run"))
            run.SetValue("HamnafasLabel","\""+target+"\" --serve");
        if(!running) Process.Start(new ProcessStartInfo(target,"--serve"){UseShellExecute=false,CreateNoWindow=true});
        for(int attempt=0;attempt<20;attempt++){
            try {
                var request=(HttpWebRequest)WebRequest.Create("http://127.0.0.1:18742/printers");
                request.Proxy=null; request.Method="POST";request.ContentType="application/json";
                request.Headers["Origin"]=Origin;request.ContentLength=0;request.Timeout=3000;
                using(var response=request.GetResponse())
                using(var reader=new StreamReader(response.GetResponseStream())){
                    var status=Json.Deserialize<Dictionary<string,object>>(reader.ReadToEnd());
                    if(status.ContainsKey("version") && String.Equals(status["version"],Version))return;
                }
            } catch(WebException) {}
            System.Threading.Thread.Sleep(250);
        }
        throw new IOException("رابط چاپ روی این کامپیوتر پاسخ نداد.");
    }
    static int Main(string[] args) {
        if(args.Contains("--self-test")) {
            var job=new Job {id=Guid.NewGuid().ToString(),width=8,height=32,pages=new[]{new string('0',64)}};
            if(!Encoding.ASCII.GetString(Encode(job)).Contains("^GFA,32,32,1,"))return 1;
            job.pages[0]=new string('^',64);
            try { Encode(job);return 1; } catch(ArgumentException) { return 0; }
        }
        if(!args.Contains("--serve")) {
            if(MessageBox.Show("رابط چاپ هم‌نفس برای کاربر فعلی نصب شود و هنگام ورود به ویندوز اجرا شود؟","نصب رابط چاپ هم‌نفس",MessageBoxButtons.YesNo) != DialogResult.Yes)return 0;
            try {
                Install();
                MessageBox.Show("رابط چاپ برای این کاربر نصب شد. به صفحهٔ چاپ لیبل در هم‌نفس برگردید.","هم‌نفس");
                return 0;
            } catch(Exception e) {
                MessageBox.Show("نصب انجام نشد. "+e.Message,"هم‌نفس");
                return 1;
            }
        }
        Directory.CreateDirectory(Claims);
        foreach (string file in Directory.GetFiles(Claims)) if(File.GetCreationTimeUtc(file)<DateTime.UtcNow.AddDays(-30)) File.Delete(file);
        using(var server=new HttpListener()) {
            server.Prefixes.Add("http://127.0.0.1:18742/");
            try { server.Start(); } catch(HttpListenerException){ return 2; }
            while(true) {
                var c=server.GetContext();
                try { Handle(c); }
                catch(ArgumentException) { Reply(c.Response,400,false); }
                catch(Exception) { try { Reply(c.Response,503,false); } catch(IOException) {} catch(HttpListenerException) {} }
                finally { c.Response.Close(); }
            }
        }
    }
}
