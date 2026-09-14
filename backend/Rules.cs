using System.Text.Json.Nodes;
using System.Globalization;
namespace Nafasyar;
public class Rules(string root){
 public JsonNode Spec{get;}=JsonNode.Parse(File.ReadAllText(Path.Combine(root,"model-spec.json")))!;
 public string[] Modules=>Spec["modules"]!.AsArray().Select(n=>n!.GetValue<string>()).ToArray();
 public string[] Stages=>Spec["stages"]!.AsArray().Select(n=>n!.GetValue<string>()).ToArray();
 public JsonArray Fields(string kind)=>Spec["fields"]?[kind]?.AsArray()??throw new ApiError("نوع رکورد معتبر نیست.");
 public string[] Editable(string kind)=>Spec["editable"]?[kind]?.AsArray().Select(n=>n!.GetValue<string>()).ToArray()??[];
 public Permissions Permissions(JsonNode? n){var p=n?.Deserialize<Permissions>(J.Options)??throw new ApiError("دسترسی معتبر نیست.");if(p.Read==null||p.Write==null||p.EventStages==null||p.Read.Any(k=>!Modules.Contains(k))||p.Write.Any(k=>!p.Read.Contains(k))||p.EventStages.Any(s=>!Stages.Contains(s)))throw new ApiError("دسترسی معتبر نیست.");foreach(var kind in new[]{"event","service","action"})if(p.Write.Contains(kind)&&(!p.Read.Contains("device")||!p.Read.Contains("batch")))throw new ApiError("مشاهده دستگاه و بچ لازم است.");if(p.Write.Contains("event")&&p.EventStages.Length==0)throw new ApiError("مرحله مجاز را انتخاب کنید.");if(p.Read.Contains("distribution")&&!p.Read.Contains("device"))throw new ApiError("مشاهده دستگاه لازم است.");return new(p.Read.Distinct().ToArray(),p.Write.Distinct().ToArray(),p.Write.Contains("event")?p.EventStages.Distinct().ToArray():[]);}
 public void Validate(string kind,Dictionary<string,string>d){foreach(var f in Fields(kind)){var key=J.Text(f,"key");var label=J.Text(f,"label");var v=d.Text(key);if(f?["required"]?.GetValue<bool>()==true&&string.IsNullOrWhiteSpace(v))throw new ApiError(label+" الزامی است.");if(v.Length>4000)throw new ApiError("متن بیش از حد طولانی است.");if(v.Length==0)continue;if(f?["options"] is JsonArray options&&!options.Any(o=>o!.GetValue<string>()==v))throw new ApiError(label+" معتبر نیست.");if(J.Text(f,"type")=="number"&&(!double.TryParse(v,NumberStyles.Float,CultureInfo.InvariantCulture,out var x)||!double.IsFinite(x)||x<0))throw new ApiError(label+" باید نامنفی باشد.");if(J.Text(f,"type")=="date")J.Jalali(v);}
 double N(string k)=>double.TryParse(d.Text(k),NumberStyles.Float,CultureInfo.InvariantCulture,out var n)?n:0;
 if(kind=="product"&&(!J.Match(d.Text("code"),@"^[A-Z0-9][A-Z0-9._-]{0,79}$")||N("warrantyMonths")%1!=0||N("warrantyMonths")>9007199254740991))throw new ApiError("کد محصول یا مدت گارانتی معتبر نیست.");
 if(kind=="batch"){if(N("quantity")<=0)throw new ApiError("مقدار ورودی باید مثبت باشد.");if(d.Text("partCode")!="")Part(d.Text("partCode"));if(d.Text("batchScheme")!=""){var prefix=Part(d.Text("partCode"))+"-"+J.Jalali(d.Text("date"))+"-";var code=d.Text("code");if(d.Text("batchScheme")!="part-jalali-v1"||!code.StartsWith(prefix)||!J.Match(code[prefix.Length..],@"^\d{3,}$")||!long.TryParse(code[prefix.Length..],out var sequence)||sequence<=0||sequence>9007199254740991)throw new ApiError("بچ با الگوی پیشنهادی تطابق ندارد.");}}
 if(kind=="event"&&d.Text("stage")=="مصرف قطعه"&&(d.Text("batch")==""||N("quantity")<=0))throw new ApiError("بچ و مقدار مثبت مصرف الزامی است.");
 if(kind=="event"&&d.Text("stage")=="تحویل"&&string.IsNullOrWhiteSpace(d.Text("customer")))throw new ApiError("مقصد تحویل الزامی است.");
 if(kind=="event"&&d.Text("stage")=="آزمون نهایی"&&(d.Text("result")==""||string.IsNullOrWhiteSpace(d.Text("notes"))))throw new ApiError("نتیجه و جزئیات آزمون لازم است.");
 if(N("purity")>100)throw new ApiError("خلوص بیش از ۱۰۰ معتبر نیست.");
 if(kind=="action"&&d.Text("status")=="بسته‌شده"&&(string.IsNullOrWhiteSpace(d.Text("cause"))||string.IsNullOrWhiteSpace(d.Text("effectiveness"))))throw new ApiError("علت و اثربخشی الزامی است.");
 if(kind=="service"&&d.Text("replacement")!=""&&d.Text("batch")=="")throw new ApiError("بچ خارج‌شده را مشخص کنید.");
 }
 public static string Part(string code){code=J.Digits(code).Trim();if(!J.Match(code,@"^\d{2,12}$"))throw new ApiError("کد قطعه باید ۲ تا ۱۲ رقم باشد.");return code;}
}
