import {KeyboardEvent,ReactNode} from 'react';
import {Icon} from './Icon';

export interface AdminTask {id:string;label:string;icon:Parameters<typeof Icon>[0]['name']}
export function AdminTaskTabs({tasks,value,onChange,id,label}:{tasks:AdminTask[];value:string;onChange:(value:string)=>void;id:string;label:string}){
 const key=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{
  if(event.altKey||event.ctrlKey||event.metaKey)return;
  let next:number;
  if(event.key==='Home')next=0;else if(event.key==='End')next=tasks.length-1;
  else if(event.key==='ArrowLeft')next=(index+1)%tasks.length;else if(event.key==='ArrowRight')next=(index-1+tasks.length)%tasks.length;else return;
  event.preventDefault();onChange(tasks[next].id);document.getElementById(`${id}-tab-${tasks[next].id}`)?.focus();
 };
 return <div className="admin-task-tabs" role="tablist" aria-label={label}>{tasks.map((task,index)=><button key={task.id} type="button" role="tab" id={`${id}-tab-${task.id}`} aria-controls={`${id}-panel-${task.id}`} aria-selected={value===task.id} tabIndex={value===task.id?0:-1} onKeyDown={event=>key(event,index)} onClick={()=>onChange(task.id)}><Icon name={task.icon}/><span>{task.label}</span></button>)}</div>;
}
/** Opened tasks stay mounted so uploads and unsaved inputs survive tab changes. */
export function AdminTaskPanel({id,task,active,children}:{id:string;task:string;active:string;children:ReactNode}){
 return <section className="admin-task-panel" role="tabpanel" id={`${id}-panel-${task}`} aria-labelledby={`${id}-tab-${task}`} hidden={active!==task} tabIndex={0}>{children}</section>;
}
