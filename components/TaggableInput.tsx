import React, { useState } from 'react';

interface TaggableInputProps {
    label: string;
    value: string[];
    onChange: (value: string[]) => void;
    suggestions: string[];
    placeholder?: string;
    className?: string;
}

const TaggableInput: React.FC<TaggableInputProps> = ({ label, value, onChange, suggestions, placeholder, className = "md:col-span-2 lg:col-span-4" }) => {
    const [inputValue, setInputValue] = useState('');
    const filteredSuggestions = (inputValue.length > 1) ? suggestions.filter(
        s => s.toLowerCase().includes(inputValue.toLowerCase()) && !value.find(v => v.toLowerCase() === s.toLowerCase())
    ).slice(0, 10) : []; // Limit to 10 suggestions for performance and only show after 2 chars

    const addItem = (item: string) => {
        const trimmedItem = item.trim();
        if (trimmedItem && !value.find(v => v.toLowerCase() === trimmedItem.toLowerCase())) {
            onChange([...value, trimmedItem]);
        }
        setInputValue('');
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputValue) {
            e.preventDefault();
            addItem(inputValue);
        }
    };

    const removeItem = (item: string) => {
        onChange(value.filter(i => i !== item));
    };

    const labelBaseClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div className={`relative ${className}`}>
            <label className={labelBaseClasses}>{label}</label>
            <div className="flex flex-wrap gap-2 p-2 mt-1 border border-gray-300 dark:border-gray-600 rounded-md min-h-[42px] focus-within:ring-1 focus-within:ring-ams-light-blue focus-within:border-ams-light-blue">
                {value.map(item => (
                    <span key={item} className="flex items-center gap-2 bg-ams-blue text-white text-sm font-semibold px-2 py-1 rounded-full">
                        {item}
                        <button type="button" onClick={() => removeItem(item)} className="text-white hover:text-red-300 font-bold text-lg leading-none">&times;</button>
                    </span>
                ))}
                <input
                    type="text"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-grow bg-transparent focus:outline-none dark:text-gray-200"
                    placeholder={value.length === 0 ? placeholder : ""}
                />
            </div>
            {filteredSuggestions.length > 0 && (
                <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredSuggestions.map(sugg => (
                        <li key={sugg} onClick={() => addItem(sugg)} className="px-4 py-2 cursor-pointer hover:bg-ams-light-blue hover:text-white dark:text-gray-200">
                            {sugg}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default TaggableInput;