import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AreasRedirectPage({ params }: Props) {
  const { id } = await params
  redirect(`/dashboard/areas/${id}`)
}
