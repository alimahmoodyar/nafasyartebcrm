using Microsoft.Data.Sqlite;
using System.Text.Json.Nodes;
namespace Nafasyar;
public class Database {
 public string DirectoryPath{get;} public string FilePath=>Path.Combine(DirectoryPath,"nafasyar.sqlite");
 public Database(string dir){DirectoryPath=Path.GetFullPath(dir);Directory.CreateDirectory(DirectoryPath);Directory.CreateDirectory(Path.Combine(DirectoryPath,"objects"));}
 public Store Open(){var c=new SqliteConnection(new SqliteConnectionStringBuilder{DataSource=FilePath,ForeignKeys=true,DefaultTimeout=10}.ToString());c.Open();return new Store(c);}
 public void Initialize(string root){using var db=Open();db.Exec("PRAGMA journal_mode=WAL");db.Exec("CREATE TABLE IF NOT EXISTS local_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL)");foreach(var f in System.IO.Directory.GetFiles(Path.Combine(root,"Migrations"),"*.sql").Order()){var name=Path.GetFileName(f);var bytes=File.ReadAllBytes(f);var hash=J.Hash(bytes);var old=db.One("SELECT sha256 FROM local_migrations WHERE name=?",name);if(old!=null){if((string)old["sha256"]! != hash)throw new Exception("Applied migration changed: "+name);continue;}db.Atomic(()=>{foreach(var statement in System.Text.Encoding.UTF8.GetString(bytes).Split("--> statement-breakpoint",StringSplitOptions.RemoveEmptyEntries))db.Exec(statement);db.Exec("INSERT INTO local_migrations VALUES(?,?)",name,hash);return 0;});}
 db.Exec("CREATE TABLE IF NOT EXISTS dotnet_accounts(email TEXT PRIMARY KEY,subject TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password_hash TEXT NOT NULL,stamp TEXT NOT NULL,username TEXT UNIQUE NOT NULL,must_change INTEGER NOT NULL DEFAULT 1)");
 }
 public string ObjectPath(string key){if(!key.StartsWith("firmware/")||key.Contains("..")||key.Contains('\\')||key.Contains('\0'))throw new ApiError("نام فایل معتبر نیست.");var root=Path.Combine(DirectoryPath,"objects");var file=Path.GetFullPath(Path.Combine(root,key));if(!file.StartsWith(root+Path.DirectorySeparatorChar))throw new ApiError("نام فایل معتبر نیست.");return file;}
}
public sealed class Store(SqliteConnection connection):IDisposable {
 public SqliteConnection Connection{get;}=connection;private SqliteTransaction? tx;
 SqliteCommand Command(string query,object?[] args){var c=Connection.CreateCommand();c.Transaction=tx;int i=0;c.CommandText=System.Text.RegularExpressions.Regex.Replace(query,@"\?",_=>"@p"+(i++));if(i!=args.Length)throw new Exception("SQL parameter mismatch");for(var j=0;j<args.Length;j++)c.Parameters.AddWithValue("@p"+j,args[j]??DBNull.Value);return c;}
 public int Exec(string sql,params object?[] args){using var c=Command(sql,args);return c.ExecuteNonQuery();}
 public List<Dictionary<string,object?>> All(string sql,params object?[] args){using var c=Command(sql,args);using var r=c.ExecuteReader();var rows=new List<Dictionary<string,object?>>();while(r.Read()){var d=new Dictionary<string,object?>();for(int i=0;i<r.FieldCount;i++)d[r.GetName(i)]=r.IsDBNull(i)?null:r.GetValue(i);rows.Add(d);}return rows;}
 public Dictionary<string,object?>? One(string sql,params object?[] args)=>All(sql,args).FirstOrDefault();
 public T Atomic<T>(Func<T> work){using var transaction=Connection.BeginTransaction(deferred:false);tx=transaction;try{var result=work();transaction.Commit();return result;}finally{tx=null;}}
 public void Audit(Actor a,string target,string action,object? after,string? before=null)=>Exec("INSERT INTO access_audit(id,actor,target,action,before,after,at) VALUES(?,?,?,?,?,?,?)",Guid.NewGuid().ToString(),a.UserId,target,action,before,J.Write(after),J.Now());
 public Row? Record(string id){var r=One("SELECT * FROM records WHERE id=?",id);return r==null?null:Row.From(r);}
 public void Dispose()=>Connection.Dispose();
}
