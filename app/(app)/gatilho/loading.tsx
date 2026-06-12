export default function Loading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="h-7 bg-gray-100 rounded-lg w-52" />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
      </div>
      <div className="h-10 bg-gray-100 rounded-xl w-96" />
      <div className="h-72 bg-gray-100 rounded-xl" />
      <div className="h-48 bg-gray-100 rounded-xl" />
    </div>
  )
}
