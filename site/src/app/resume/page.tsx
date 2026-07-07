export const dynamic = "force-static";

export default function ResumePage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <h1 className="text-4xl font-bold mb-4">Resume</h1>
      <p className="text-neutral-600 dark:text-neutral-400 mb-6">
        View the embedded PDF below or download the{' '}
        <a className="text-blue-600 dark:text-blue-400 hover:underline" href="/Aiden-Lee-Resume.pdf" target="_blank" rel="noreferrer">PDF</a>.
      </p>
      <div className="border rounded-lg overflow-hidden">
        <iframe
          src="/Aiden-Lee-Resume.pdf"
          className="w-full h-[80vh]"
          title="Aiden Lee Resume"
        />
      </div>
    </main>
  );
}


