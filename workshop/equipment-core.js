export const equipmentTypes=['Электросамокаты','Электровелосипеды','Велосипеды','Электромопеды','Электроскутеры','Другая техника'];
export function equipmentType(product){
 const category=String(product.category||'').trim();
 if(category.startsWith('Техника · '))return category.slice(10);
 return equipmentTypes.find(type=>type.toLowerCase()===category.toLowerCase())||null;
}
export function filterEquipment(products,{search='',type='',available=false}={}){
 const q=search.trim().toLowerCase();
 return products.filter(x=>x.active!==false&&equipmentType(x)&&(!type||equipmentType(x)===type)&&(!available||Number(x.quantity)>0)&&[x.name,x.model,x.sku,x.barcode].join(' ').toLowerCase().includes(q));
}
