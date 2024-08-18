export default function AppFooter() {
  return (
    <footer className="fixed inset-x-0 bottom-0 p-3 bg-gray-100 text-gray-600 text-xs text-center">
      <div>© {new Date().getFullYear()} The CloudWatch Book. All rights reserved.</div>
    </footer>
  );
}
