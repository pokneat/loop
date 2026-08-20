export default function ThemesLoading() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="h-7 w-48 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-4 w-72 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="grid gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-lg border border-gray-200 bg-white px-5 py-4 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
