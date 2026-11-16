const crypto=require('node:crypto');
module.exports=function personnelFixture(sql,name,now=new Date().toISOString(),mobile='09121234567'){
 const mid='person:'+crypto.randomUUID(),id='hr-profile:'+mid,data={memberId:mid,name,code:'P-'+crypto.randomUUID().replaceAll('-',''),unit:'Office',title:'Staff',location:'Office',employment:'Fixed',managerId:'fixture-manager',start:'2020-01-01',end:'',nationalId:'1234567890',birthDate:'1990-01-01',maritalStatus:'single',childrenCount:0,mobile,address:'Fixture address',emergencyContact:'Fixture emergency',bankAccount:'Fixture account',leaveMinutes:0,state:'active',identityCompleteAt:now,history:[]};
 sql.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'hr_employee',?,1,?,?)").run(id,JSON.stringify(data),now,now);
 for(const category of ['national_card','birth_certificate','spouse_page','children_page'])sql.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'hr_file',?,1,?,?)").run(crypto.randomUUID(),JSON.stringify({caseId:id,category,filename:category+'.png',sha256:'fixture',byteSize:10,objectKey:'fixture-local-only/'+id+'/'+category}),now,now);
 return id;
};
