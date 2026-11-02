import type {ReactNode} from 'react';
export function InspectorSection({title,open,onChange,children,className=''}:{title:string;open:boolean;onChange:(open:boolean)=>void;children:ReactNode;className?:string}) {
 return <details className={`inspector-section ${className}`} open={open} onToggle={e=>{if(e.currentTarget.open!==open)onChange(e.currentTarget.open);}}><summary>{title}</summary><div className="inspector-section-body">{children}</div></details>;
}
