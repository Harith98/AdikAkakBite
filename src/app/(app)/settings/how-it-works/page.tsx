import Link from 'next/link'
import type { ReactNode } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

export const metadata = { title: 'How it works' }

/** The topics, in the order a question usually comes up. Each has its own #anchor, so other pages can link straight to it. */
const TOPICS: { id: string; emoji: string; title: string }[] = [
  { id: 'prices', emoji: '🏷️', title: 'Changing a selling price' },
  { id: 'costs', emoji: '🧁', title: 'Changing a product’s cost' },
  { id: 'ingredients', emoji: '🥣', title: 'Ingredient prices & recipes' },
  { id: 'stock', emoji: '📦', title: 'Ready stock vs inventory' },
  { id: 'sale-day', emoji: '📅', title: 'When a sale counts' },
  { id: 'orders', emoji: '✏️', title: 'Editing or cancelling an order' },
  { id: 'expenses', emoji: '🧾', title: 'Expenses vs product costs' },
  { id: 'profit', emoji: '📊', title: 'How profit is worked out' },
  { id: 'checking', emoji: '🔎', title: 'Checking the numbers' },
]

/**
 * Settings → How it works: what happens to the numbers when you change
 * prices, costs, recipes, stock, orders and expenses, so nobody has to guess.
 */
export default function HowItWorksPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        back={{ href: '/settings', label: 'Settings' }}
        title="How it works"
        subtitle="What happens to your numbers when you change a price, a cost, a recipe or an order."
      />

      <Card className="!border-sage/40 !bg-sage-soft/50">
        <p className="font-display text-lg text-ink">The 5 rules behind every number</p>
        <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-ink">
          <li>
            <b>The past never changes.</b> Each sale keeps the price it was sold at and the cost it had on that day.
          </li>
          <li>
            <b>A change applies from the moment you save it.</b> New prices and costs only affect what happens next.
          </li>
          <li>
            <b>A sale counts on the day the order is completed,</b> not the day it was taken or due.
          </li>
          <li>
            <b>Ingredients and packaging go in product costs; rent, bills and petrol go in Expenses.</b> Never both.
          </li>
          <li>
            <b>Nothing is guessed.</b> Every total is added up from your orders, costs and expenses, and you can download the list behind it.
          </li>
        </ol>
      </Card>

      <nav aria-label="Topics" className="flex flex-wrap gap-2">
        {TOPICS.map((t) => (
          <a key={t.id} href={`#${t.id}`} className="rounded-pill bg-base-card px-3 py-1.5 text-sm text-ink shadow-card hover:bg-raspberry-soft">
            {t.emoji} {t.title}
          </a>
        ))}
      </nav>

      <Topic id="prices">
        <P>
          Every order saves the price of each item <b>at the moment it’s taken</b>. Changing a product’s price only affects orders
          taken after that.
        </P>
        <Steps>
          <li>Past orders, receipts and sales keep their old price.</li>
          <li>Open orders (not yet completed) also keep the price they were taken at. To charge the new price, edit that order.</li>
          <li>Editing an old order keeps its saved prices, unless you pick a product again on a line: that line takes today’s price.</li>
        </Steps>
        <Example good>Brownies go from RM 40 to RM 45 on 1 Nov → September’s report still shows RM 40 sales.</Example>
      </Topic>

      <Topic id="costs">
        <P>
          A product’s cost (ingredients + packaging + other) is <b>dated</b>. When you change it, the old cost is kept and the new one
          starts from that moment. Each product’s page shows its <b>Cost history</b>.
        </P>
        <Steps>
          <li>Sales before the change use the old cost; sales after use the new one.</li>
          <li>If a sale happened before any cost was entered, it uses the first cost you entered afterwards.</li>
          <li>A cost of RM 0 counts as “not entered”: those items are listed as missing a cost in the Sales report, so profit doesn’t look better than it is.</li>
        </Steps>
        <Example good>Enter costs as soon as you add a product, so every sale has the right cost from day one.</Example>
        <Example>Don’t lower a cost to “fix” an old month: it only changes sales from today.</Example>
      </Topic>

      <Topic id="ingredients">
        <P>
          An ingredient’s <b>Cost per unit</b> (in Inventory) is what one kg, pack or piece costs <b>today</b>. Recipes use it to work
          out what each product costs to make.
        </P>
        <Steps>
          <li>Change an ingredient’s price in Inventory → its recipes cost more (or less) straight away.</li>
          <li>The products using it are marked <b>Cost out of date</b>: their saved cost (what profit uses) still has the old price.</li>
          <li>
            Tap <b>Update all</b> → each product gets a new cost from today, worked out from its recipe. Sales before today keep the old
            cost.
          </li>
        </Steps>
        <Example good>Butter goes up → update its price → Update all → profit from today uses the real cost.</Example>
        <Example>If you skip Update all, profit keeps using the old, cheaper cost and looks higher than it is.</Example>
      </Topic>

      <Topic id="stock">
        <P>There are two separate kinds of stock:</P>
        <Steps>
          <li>
            <b>Ready stock</b> (on each product): finished cakes on the shelf, ready to sell. Only for products you track; leave it off for
            made-to-order ones.
          </li>
          <li>
            <b>Inventory</b>: ingredients and packaging. Their amounts go down when you bake (with a recipe) and up when you log a purchase.
          </li>
        </Steps>
        <P>When an order is marked <b>completed</b>:</P>
        <Steps>
          <li>Tracked products come off ready stock.</li>
          <li>Made-to-order products use up their recipe’s ingredients from inventory.</li>
          <li>Reopening or cancelling a completed order puts both back exactly.</li>
          <li>Recording a <b>past sale</b> touches neither, because it’s already gone.</li>
        </Steps>
      </Topic>

      <Topic id="sale-day">
        <P>
          A sale counts on the day its order is <b>completed</b>. Taking an order or its due date doesn’t count as a sale.
        </P>
        <Steps>
          <li>The Orders page groups by <b>due date</b>; Sales and the money reports go by <b>sale date</b>.</li>
          <li>So an order due 30 Sep but completed 1 Oct is in September on Orders and in October in Sales.</li>
          <li>Forgot to mark it the day it was handed over? Change its sale date on the order page.</li>
          <li>Selling something you didn’t enter at the time? Use “past sale” when adding the order: it counts on that day.</li>
        </Steps>
      </Topic>

      <Topic id="orders">
        <Steps>
          <li>Editing an order saves everything in one go: if something fails, nothing changes, and items are never doubled.</li>
          <li>Cancelling an order takes it out of sales. You can reopen it later.</li>
          <li>Deleting a product doesn’t touch past orders: each order keeps its own copy of the name and price.</li>
          <li>Receipt numbers are given once and never reused, even if the order is reopened.</li>
        </Steps>
      </Topic>

      <Topic id="expenses">
        <P>
          <b>Expenses are overheads only</b>: what the shop spends that isn’t part of making a product. Ingredients and packaging are
          already counted through product costs, so adding them here would count them twice.
        </P>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-card bg-sage-soft px-3 py-2.5 text-sm">
            <p className="font-medium text-sage-dark">✓ Add to Expenses</p>
            <p className="mt-1 text-ink">Rent · electric, water, internet · petrol, tolls, rider fees · oven, mixer, tins · boosted posts, flyers</p>
          </div>
          <div className="rounded-card bg-clay-soft px-3 py-2.5 text-sm">
            <p className="font-medium text-clay-dark">✗ Don’t add to Expenses</p>
            <p className="mt-1 text-ink">Flour, butter, chocolate, eggs · boxes, ribbons, labels (put these in Inventory and product costs)</p>
          </div>
        </div>
        <Steps>
          <li>An expense counts once its date has passed. Dates can’t be in the future.</li>
          <li>
            <b>Monthly costs</b> (rent) are entered once and repeat on the same day each month. <b>Change</b> = a new amount from this month
            (earlier months keep the old one, no month counts both). <b>Stop</b> = it ends after this month.
          </li>
          <li>Deleting a monthly cost removes it from every month, past ones included. To end it, use Stop instead.</li>
        </Steps>
      </Topic>

      <Topic id="profit">
        <div className="flex flex-col gap-2 rounded-card bg-base-soft p-3 font-mono text-xs text-ink sm:text-sm">
          <span>Sales (what customers paid, after discounts, plus delivery)</span>
          <span>− Cost of products (each item at its cost on the sale day)</span>
          <span className="border-t border-ink/10 pt-2 font-semibold">= Gross profit</span>
          <span>− Overheads (Expenses that month)</span>
          <span className="border-t border-ink/10 pt-2 font-semibold">= Net profit: what you actually kept</span>
        </div>
        <Steps>
          <li>A product’s <b>margin</b> (on its page) is its price minus today’s cost: what one sale earns now.</li>
          <li>Gross and net profit are on <b>Sales → monthly report</b>, for any month.</li>
          <li>Items with no cost entered are listed there: until you add a cost, profit is shown too high by them.</li>
        </Steps>
      </Topic>

      <Topic id="checking">
        <P>
          Settings → <Link href="/settings/export" className="font-medium text-raspberry-dark underline">Export data</Link> → Money reports, for any dates:
        </P>
        <Steps>
          <li>
            <b>Monthly summary</b>: one row per month. Its TOTAL row should equal the <b>Sales detail</b> TOTAL (order totals and cost), and
            the <b>Expenses</b> TOTAL (overheads).
          </li>
          <li>
            <b>Sales detail</b> lists every item sold, with its sale date, customer, price and the <b>unit cost used</b>, so you can trace any
            figure to the sales behind it. Filter it in Excel or Google Sheets by date or customer.
          </li>
          <li>Download the lists once a month and keep them in Google Drive: the free plan has no automatic backups.</li>
        </Steps>
      </Topic>
    </div>
  )
}

function Topic({ id, children }: { id: string; children: ReactNode }) {
  const topic = TOPICS.find((t) => t.id === id)!
  return (
    <Card>
      <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
        <h2 id={`${id}-title`} className="flex items-center gap-2 font-display text-xl text-ink">
          <span aria-hidden="true">{topic.emoji}</span>
          {topic.title}
        </h2>
        <div className="mt-2 flex flex-col gap-2">{children}</div>
      </section>
    </Card>
  )
}

const P = ({ children }: { children: ReactNode }) => <p className="text-sm text-ink">{children}</p>

const Steps = ({ children }: { children: ReactNode }) => <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-muted">{children}</ul>

function Example({ children, good = false }: { children: ReactNode; good?: boolean }) {
  return (
    <p className={good ? 'rounded-card bg-sage-soft px-3 py-2 text-sm text-sage-dark' : 'rounded-card bg-clay-soft px-3 py-2 text-sm text-clay-dark'}>
      {good ? '✓ ' : '✗ '}
      {children}
    </p>
  )
}
