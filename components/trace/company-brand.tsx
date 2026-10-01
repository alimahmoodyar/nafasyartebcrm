export function CompanyBrand({login=false}:{login?:boolean}){
 return <div className={'company-brand '+(login?'company-brand-login':'company-brand-header')}>
  <div className="company-logo"><img src="/brand/nafasyar-logo.png" alt="نفس‌یار — NAFASYAR" width={1739} height={901}/></div>
  <div className="company-brand-copy"><p className="company-slogan">با من نفس بکش</p>{!login&&<p className="company-context">سامانه جامع نفس‌یار</p>}</div>
 </div>;
}
