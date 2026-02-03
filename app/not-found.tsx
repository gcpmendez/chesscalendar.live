import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
            <h2 className="text-4xl font-bold mb-4 text-white">404 - Not Found</h2>
            <p className="mb-8 text-neutral-400">Could not find the requested resource.</p>
            <Link href="/" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold">
                Return Home
            </Link>
        </div>
    )
}
