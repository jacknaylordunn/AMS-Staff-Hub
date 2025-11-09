import React from 'react';

export const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6 ${className}`}>
    <h2 className="text-xl font-bold text-ams-blue dark:text-ams-light-blue border-b dark:border-gray-700 pb-2 mb-4">{title}</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {children}
    </div>
  </div>
);

export const FieldWrapper: React.FC<{ children: React.ReactNode, className?: string}> = ({children, className}) => <div className={className}>{children}</div>;

export const inputBaseClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400 disabled:bg-gray-100 dark:disabled:bg-gray-700/50";
export const labelBaseClasses = "block text-sm font-medium text-gray-700 dark:text-gray-400";

export const InputField: React.FC<{ label: string; name: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; required?: boolean; className?: string; list?: string; disabled?: boolean }> = 
({ label, name, value, onChange, type = 'text', required = false, className, list, disabled = false }) => (
  <FieldWrapper className={className}>
    <label htmlFor={name} className={labelBaseClasses}>{label}{required && <span className="text-red-500">*</span>}</label>
    <input type={type} id={name} name={name} value={value} onChange={onChange} required={required} className={inputBaseClasses} list={list} disabled={disabled} />
  </FieldWrapper>
);

export const SelectField: React.FC<{ label: string; name: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode, className?: string; required?: boolean; disabled?: boolean }> = 
({ label, name, value, onChange, children, className, required = false, disabled = false }) => (
    <FieldWrapper className={className}>
        <label htmlFor={name} className={labelBaseClasses}>{label}{required && <span className="text-red-500">*</span>}</label>
        <select id={name} name={name} value={value} onChange={onChange} className={inputBaseClasses} required={required} disabled={disabled}>
            {children}
        </select>
    </FieldWrapper>
);

export const TextAreaField: React.FC<{ label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; rows?: number; className?: string }> = 
({ label, name, value, onChange, rows = 3, className = "md:col-span-2 lg:col-span-4" }) => (
  <FieldWrapper className={className}>
    <label htmlFor={name} className={labelBaseClasses}>{label}</label>
    <textarea id={name} name={name} value={value} onChange={onChange} rows={rows} className={inputBaseClasses} />
  </FieldWrapper>
);

export const CheckboxField: React.FC<{ label: string; name: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; }> = ({ label, name, checked, onChange }) => (
    <div className="flex items-center">
        <input type="checkbox" id={name} name={name} checked={checked} onChange={onChange} className="h-4 w-4 rounded border-gray-300 text-ams-light-blue focus:ring-ams-light-blue" />
        <label htmlFor={name} className="ml-2 block text-sm text-gray-900 dark:text-gray-300">{label}</label>
    </div>
);
