using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Encodings.Web;
using System.Text.RegularExpressions;
using System.Security.Cryptography;
namespace Nafasyar;
public class ApiError(string message,int status=400):Exception(message){public int Status {get;}=status;}
public static class J {
 public static readonly JsonSerializerOptions Options=new(){PropertyNamingPolicy=JsonNamingPolicy.CamelCase,Encoder=JavaScriptEncoder.UnsafeRelaxedJsonEscaping};
 public static string Write(object? v)=>JsonSerializer.Serialize(v,Options);
 public static string Text(JsonNode? n,string key,string fallback="")=>n?[key]?.GetValue<string>()??fallback;
 public static string Text(this Dictionary<string,string> d,string key)=>d.GetValueOrDefault(key,"");
 public static Dictionary<string,string> Data(JsonNode? node){if(node is not JsonObject obj)throw new ApiError("اطلاعات معتبر نیست.");var d=new Dictionary<string,string>();foreach(var p in obj){if(p.Value is not JsonValue v||!v.TryGetValue<string>(out var s))throw new ApiError("اطلاعات باید متنی باشد.");d[p.Key]=s;}return d;}
 public static string Now()=>DateTimeOffset.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'");
 public static string Hash(byte[] b)=>Convert.ToHexString(SHA256.HashData(b)).ToLowerInvariant();
 public static string Digits(string s)=>string.Concat(s.Select(c=>c>='۰'&&c<='۹'?(char)('0'+c-'۰'):c>='٠'&&c<='٩'?(char)('0'+c-'٠'):c));
 public static string Serial(string s)=>Digits(s).Trim().ToUpperInvariant();
 public static string Day(){var t=TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTimeOffset.UtcNow,"Asia/Tehran");return t.ToString("yyyy-MM-dd");}
 public static string Jalali(string date,bool display=false){if(!DateOnly.TryParseExact(date,"yyyy-MM-dd",CultureInfo.InvariantCulture,DateTimeStyles.None,out var d)||d.Year<1900||d.Year>2100)throw new ApiError("تاریخ معتبر را به صورت YYYY-MM-DD وارد کنید.");var c=new PersianCalendar();var t=d.ToDateTime(TimeOnly.MinValue);var sep=display?"/":"";return $"{c.GetYear(t):0000}{sep}{c.GetMonth(t):00}{sep}{c.GetDayOfMonth(t):00}";}
 public static string Esc(string? s)=>System.Net.WebUtility.HtmlEncode(s??"");
 public static bool Match(string s,string pattern)=>Regex.IsMatch(s,pattern,RegexOptions.CultureInvariant,TimeSpan.FromSeconds(1));
 public static bool Same(string a,string b)=>JsonNode.DeepEquals(JsonNode.Parse(a),JsonNode.Parse(b));
}
public record Row(string Id,string Kind,string Created,Dictionary<string,string> Data){public static Row From(Dictionary<string,object?> r)=>new((string)r["id"]!,(string)r["kind"]!,(string)r["created"]!,J.Data(JsonNode.Parse((string)r["payload"]!)));}
public record Permissions(string[] Read,string[] Write,string[] EventStages);
public record Actor(string UserId,string Email,string Name,bool IsAdmin,Permissions Permissions,bool MustChange=false){public void Require(string kind,string op="read"){if(!IsAdmin&&!(op=="write"?Permissions.Write:Permissions.Read).Contains(kind))throw new ApiError("دسترسی این بخش مجاز نیست.",403);}public void Admin(){if(!IsAdmin)throw new ApiError("این عملیات مخصوص مدیر است.",403);}}
