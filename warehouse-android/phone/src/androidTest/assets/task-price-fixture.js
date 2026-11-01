// Instrumentation fixture only. This is served by the test APK, never by the release.
(function () {
 var actor='11111111-1111-4111-8111-111111111111', taskId='22222222-2222-4222-8222-222222222222', workId='33333333-3333-4333-8333-333333333333';
 var state=window.phoneTaskFixture={price:500,saves:0,actions:[],errors:[]};
 window.addEventListener('error',function(event){if(event.message)state.errors.push(event.message);});
 window.addEventListener('unhandledrejection',function(event){state.errors.push(String(event.reason&&event.reason.message||event.reason));});
 localStorage.setItem('fastgo_workshop_session',JSON.stringify({user_id:actor,access_token:'offline-instrumentation-fixture',expires_at:4102444800}));
 var task={id:taskId,assignee_id:actor,title:'Проверить стоимость работ',description:'Данные изолированной проверки APK.',status:'open',scopes:['works'],reviewed_scopes:[],revision:1,created_at:'2026-11-01T00:00:00Z'};
 window.fetch=function(input,options){
  var request=JSON.parse(options&&options.body||'{}'),action=request.action,p=request.params||{},data={};state.actions.push(action);
  if(action==='me')data={profile_id:actor,name:'Артем',role:'mechanic',active:true};
  else if(action==='request_access')data={active:true};
  else if(action==='staff_tasks')data={items:[task]};
  else if(action==='staff_task_get')data=task;
  else if(action==='staff_price_catalog')data={parts:[],equipment_prices:[],services:[{id:workId,title:'Диагностика',category:'Ремонтные работы',labor_price:state.price}]};
  else if(action==='staff_price_save'){
   if(p.task_id!==taskId||p.id!==workId||p.scope!=='works'||p.expected.labor_price!==state.price||p.values.labor_price!==750)throw Error('Unexpected work-price fixture write');
   state.price=p.values.labor_price;state.saves++;data={task_id:taskId,scope:'works',item_id:workId,item:{id:workId,title:'Диагностика',category:'Ремонтные работы',labor_price:state.price}};
  }else if(action==='catalog')data={parts:[],services:[],categories:[],staff:[]};
  else if(['stock','sale','payment','stock_receive','checkout','parts_issue'].indexOf(action)!==-1)throw Error('Financial or stock mutation in a navigation fixture');
  return Promise.resolve(new Response(JSON.stringify({data:data}),{status:200,headers:{'Content-Type':'application/json'}}));
 };
})();
