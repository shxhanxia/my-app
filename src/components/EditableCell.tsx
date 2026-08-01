export default function EditableCell({
    value,
    onChange,
    placeholder = 'Null',
}: {
    value: any;
    onChange: (v: string | null) => void;
    placeholder?: string;
}) {
    return (
        <input
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder={placeholder}
            className="w-full bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded px-2 py-1 -mx-2 transition-colors text-slate-700 placeholder:text-slate-300 min-w-[60px]"
        />
    );
}
