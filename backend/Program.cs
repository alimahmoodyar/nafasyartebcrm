using Nafasyar;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Microsoft.Data.Sqlite;
var builder=WebApplication.CreateBuilder(args);
var root=builder.Environment.ContentRootPath;
var database=new Database(builder.Configuration["DATA_DIR"]??Path.Combine(root,"App_Data"));database.Initialize(root);
var rules=new Rules(root);var accounts=new Accounts(database,rules,builder.Configuration);
// Commands are explicit and never overwrite populated business data.
if(args.Contains("--import")){var file=args[Array.IndexOf(args,"--import")+1];Maintenance.Import(database,file);return;}
if(args.Contains("--backup")){Maintenance.Backup(database,args[Array.IndexOf(args,"--backup")+1]);return;}
if(args.Contains("--check")){Maintenance.Check(database);return;}
if(args.Contains("--set-password")){var email=args[Array.IndexOf(args,"--set-password")+1];Console.Error.Write("New password: ");var password=Maintenance.ReadPassword();accounts.Password(email,password);Console.WriteLine("Password set; first-login change required.");return;}
var origin=builder.Configuration["PUBLIC_ORIGIN"]??"http://localhost:5080";
if(!Uri.TryCreate(origin,UriKind.Absolute,out var publicUri)||publicUri.GetLeftPart(UriPartial.Authority)!=origin||publicUri.Scheme is not("http" or "https")||publicUri.Scheme=="http"&&!publicUri.IsLoopback)throw new Exception("PUBLIC_ORIGIN must be exact HTTPS origin (HTTP allowed only on localhost)");
if(string.IsNullOrEmpty(builder.Configuration["TRACE_OWNER_EMAIL"]))throw new Exception("TRACE_OWNER_EMAIL is required");
using(var db=database.Open()){if(db.One("SELECT email FROM dotnet_accounts LIMIT 1")==null){var seed=JsonNode.Parse(File.ReadAllText(Path.Combine(root,"bootstrap-admin.json")))!;accounts.Password(accounts.Owner,J.Text(seed,"password"),J.Text(seed,"username"));}}
builder.Services.AddSingleton(database);builder.Services.AddSingleton(rules);builder.Services.AddSingleton(accounts);builder.Services.AddSingleton<AccountPages>();builder.Services.AddSingleton<RecordService>();builder.Services.AddSingleton<SerialService>();builder.Services.AddSingleton<FirmwareService>();builder.Services.AddSingleton<DistributionService>();
builder.Services.Configure<Microsoft.AspNetCore.Http.Json.JsonOptions>(o=>{o.SerializerOptions.PropertyNamingPolicy=J.Options.PropertyNamingPolicy;o.SerializerOptions.Encoder=J.Options.Encoder;});
builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(database.DirectoryPath,"keys"))).SetApplicationName("Nafasyar.DotNet8");
builder.Services.AddAuthentication("Cookies").AddCookie("Cookies",o=>{o.Cookie.Name="nafasyar_dotnet";o.Cookie.HttpOnly=true;o.Cookie.SameSite=SameSiteMode.Strict;o.Cookie.SecurePolicy=publicUri.Scheme=="https"?CookieSecurePolicy.Always:CookieSecurePolicy.None;o.LoginPath="/login";o.ExpireTimeSpan=TimeSpan.FromHours(8);o.SlidingExpiration=false;o.Events.OnRedirectToLogin=c=>{c.Response.StatusCode=401;return Task.CompletedTask;};});
builder.Services.Configure<FormOptions>(o=>{o.MultipartBodyLengthLimit=11*1024*1024;o.ValueLengthLimit=2000000;});builder.WebHost.ConfigureKestrel(o=>o.Limits.MaxRequestBodySize=12*1024*1024);
builder.Services.AddRateLimiter(o=>{o.RejectionStatusCode=429;o.AddPolicy("login",ctx=>RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString()??"unknown",_=>new FixedWindowRateLimiterOptions{PermitLimit=20,Window=TimeSpan.FromMinutes(1),QueueLimit=0}));});
var app=builder.Build();
app.Use(async(ctx,next)=>{ctx.Response.Headers["X-Content-Type-Options"]="nosniff";ctx.Response.Headers["Referrer-Policy"]="same-origin";ctx.Response.Headers["X-Frame-Options"]="SAMEORIGIN";if(ctx.Request.Path.StartsWithSegments("/api")||ctx.Request.Path.StartsWithSegments("/account")||ctx.Request.Path=="/login")ctx.Response.Headers.CacheControl="no-store";
 try{if(ctx.Request.Method is not("GET" or "HEAD" or "OPTIONS")&&ctx.Request.Headers.Origin.ToString()!=origin)throw new ApiError("درخواست از آدرس نامعتبر است.",403);await next();}
 catch(Exception e){if(ctx.Response.HasStarted)throw;var status=e is ApiError a?a.Status:e is SqliteException s?s.SqliteErrorCode==19?409:503:e is BadHttpRequestException b?b.StatusCode:e is JsonException or FormatException or InvalidOperationException?400:500;var message=e is ApiError?e.Message:status==409?"کد، سریال یا نام کاربری تکراری است.":status==400?"اطلاعات درخواست معتبر نیست.":"عملیات انجام نشد؛ دوباره تلاش کنید.";app.Logger.LogWarning("Request failed: {Type}",e.GetType().Name);ctx.Response.StatusCode=status;if(ctx.Request.Path.StartsWithSegments("/account")||ctx.Request.Path=="/login"){ctx.Response.ContentType="text/html; charset=utf-8";await ctx.Response.WriteAsync(AccountPages.Shell("بررسی اطلاعات","<p class='notice'>"+J.Esc(message)+"</p><a href='/account'>بازگشت به حساب</a> · <a href='/login'>ورود</a>"));}else await ctx.Response.WriteAsJsonAsync(new{error=message});}});
app.UseAuthentication();app.UseRateLimiter();
Actor Actor(HttpContext ctx){var a=accounts.Resolve(ctx.User)??throw new ApiError("وارد حساب خود شوید.",401);if(a.MustChange)throw new ApiError("ابتدا رمز اولیه را در بخش حساب تغییر دهید.",403);return a;}
Actor AnyActor(HttpContext ctx)=>accounts.Resolve(ctx.User)??throw new ApiError("وارد حساب خود شوید.",401);
async Task<JsonNode> Body(HttpContext c){if(c.Request.ContentLength>2000000)throw new ApiError("حجم درخواست زیاد است.",413);using var ms=new MemoryStream();var buffer=new byte[8192];int n;while((n=await c.Request.Body.ReadAsync(buffer))>0){if(ms.Length+n>2000000)throw new ApiError("حجم درخواست زیاد است.",413);ms.Write(buffer,0,n);}return JsonNode.Parse(ms.ToArray())??throw new ApiError("اطلاعات معتبر نیست.");}
string Q(HttpContext c,string k)=>c.Request.Query[k].ToString();
IResult Html(string s)=>Results.Content(s,"text/html; charset=utf-8");
app.MapGet("/login",(HttpContext c,AccountPages pages)=>accounts.Resolve(c.User)==null?Html(pages.Login()):Results.Redirect("/account"));
app.MapPost("/login",async(HttpContext c,AccountPages pages)=>{var f=await c.Request.ReadFormAsync();var login=(f["login"].Count>0?f["login"]:f["email"]).ToString().Trim().ToLowerInvariant();var password=f["password"].ToString();if(password.Length>256||!accounts.Valid(login,password)){c.Response.StatusCode=401;return Html(pages.Login("نام کاربری، رمز یا دسترسی معتبر نیست."));}var account=accounts.Find(login)!;var principal=accounts.Principal(account);var actor=accounts.Resolve(principal);if(actor==null){c.Response.StatusCode=401;return Html(pages.Login("حساب غیرفعال است."));}await c.SignInAsync("Cookies",principal,new AuthenticationProperties{IsPersistent=false});return Results.Redirect(actor.MustChange?"/account":"/",false,false);}).RequireRateLimiting("login");
app.MapPost("/logout",async(HttpContext c)=>{await c.SignOutAsync("Cookies");return Results.Redirect("/login");});
app.MapGet("/account",(HttpContext c,AccountPages pages)=>Html(pages.Home(AnyActor(c))));
app.MapPost("/account/change",async(HttpContext c,AccountPages pages)=>{pages.Change(AnyActor(c),await c.Request.ReadFormAsync());await c.SignOutAsync("Cookies");return Results.Redirect("/login");}).RequireRateLimiting("login");
app.MapPost("/account/create",async(HttpContext c,AccountPages pages)=>{pages.Member(Actor(c),await c.Request.ReadFormAsync(),false);return Results.Redirect("/account");});
app.MapPost("/account/reset",async(HttpContext c,AccountPages pages)=>{pages.Reset(Actor(c),await c.Request.ReadFormAsync());return Results.Redirect("/account");});
app.MapPost("/account/permissions",async(HttpContext c,AccountPages pages)=>{pages.Member(Actor(c),await c.Request.ReadFormAsync(),true);return Results.Redirect("/account");});
app.MapGet("/api/session",(HttpContext c)=>Actor(c));
app.MapGet("/api/records",(HttpContext c,RecordService s)=>new{records=s.List(Actor(c))});
app.MapPost("/api/records",async(HttpContext c,RecordService s)=>Results.Json(new{record=s.Create(Actor(c),await Body(c))},statusCode:201));
app.MapPatch("/api/records",async(HttpContext c,RecordService s)=>new{record=s.Update(Actor(c),await Body(c))});
app.MapGet("/api/users",(HttpContext c)=>accounts.List(Actor(c)));
app.MapPost("/api/users",async(HttpContext c)=>Results.Json(accounts.Save(Actor(c),await Body(c),false),statusCode:201));
app.MapPatch("/api/users",async(HttpContext c)=>accounts.Save(Actor(c),await Body(c),true));
app.MapGet("/api/batch-suggestion",(HttpContext c,RecordService s)=>s.Suggest(Actor(c),Q(c,"partCode"),Q(c,"date")));
app.MapGet("/api/serials",(HttpContext c,SerialService s)=>s.List(Actor(c),Q(c,"id"),Q(c,"day")));
app.MapPost("/api/serials",async(HttpContext c,SerialService s)=>s.Create(Actor(c),await Body(c)));
app.MapGet("/api/serials/print",(HttpContext c,SerialService s)=>Html(s.Print(Actor(c),Q(c,"id"),Q(c,"layout")=="thermal")));
app.MapGet("/api/distribution",(HttpContext c,DistributionService s)=>s.Get(Actor(c),Q(c,"device"),Q(c,"view")=="warranty"));
app.MapPost("/api/distribution",async(HttpContext c,DistributionService s)=>s.Post(Actor(c),await Body(c)));
app.MapGet("/api/firmware",(HttpContext c,FirmwareService s)=>s.List(Actor(c)));
app.MapPost("/api/firmware",async(HttpContext c,FirmwareService s)=>Results.Json(s.Create(Actor(c),await Body(c)),statusCode:201));
app.MapPost("/api/firmware/files",async(HttpContext c,FirmwareService s)=>{var a=Actor(c);a.Require("firmware","write");var form=await c.Request.ReadFormAsync();var file=form.Files.GetFile("file");if(file==null||form.Files.Count!=1||file.Length>FirmwareService.MaxBytes)throw new ApiError("یک فایل حداکثر ۱۰ مگابایتی انتخاب کنید.");using var ms=new MemoryStream();await file.CopyToAsync(ms);return Results.Json(s.Upload(a,Q(c,"version"),file.FileName,ms.ToArray()),statusCode:201);});
app.MapGet("/api/firmware/files",(HttpContext c,FirmwareService s)=>{var (bytes,name,hash)=s.Download(Actor(c),Q(c,"version"));c.Response.Headers["X-Content-SHA256"]=hash;return Results.File(bytes,"application/octet-stream",name);});
app.Use(async(c,next)=>{if(c.Request.Path=="/"||c.Request.Path=="/index.html"){var a=accounts.Resolve(c.User);if(a==null){c.Response.Redirect("/login");return;}if(a.MustChange){c.Response.Redirect("/account");return;}}await next();});
app.UseDefaultFiles();app.UseStaticFiles();app.Run();
