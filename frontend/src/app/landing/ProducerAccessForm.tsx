"use client";

// frontend/src/app/landing/ProducerAccessForm.tsx
// Client component separado — necessário porque usa onSubmit (event handler)

export function ProducerAccessForm() {
    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const input = e.currentTarget.querySelector("input") as HTMLInputElement;
        const slug = input.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
        if (slug) {
            window.location.href = `https://${slug}.launcheredu.com.br`;
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <input
                type="text"
                placeholder="seu-slug"
                className="flex-1 px-4 py-2 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                pattern="[a-z0-9\-]+"
                title="Apenas letras minúsculas, números e hífens"
            />
            <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
                Acessar
            </button>
        </form>
    );
}