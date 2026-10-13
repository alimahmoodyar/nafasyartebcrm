export const hospitalModelKey=(value:string)=>value.normalize('NFKC').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200e\u200f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
