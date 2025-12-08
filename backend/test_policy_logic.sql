-- Test if the policy logic would allow your user to upload
-- Replace with your actual user ID: 7b7bb049-8389-4ba9-8fac-4bcb6ba23cb7

-- This simulates what the storage policy checks
SELECT 
    b.id as booking_id,
    b.customer_id,
    b.pilot_id,
    -- Check if your user matches any condition
    (b.customer_id = '7b7bb049-8389-4ba9-8fac-4bcb6ba23cb7'::uuid) as is_customer,
    (b.pilot_id = '7b7bb049-8389-4ba9-8fac-4bcb6ba23cb7'::uuid) as is_pilot,
    EXISTS (
        SELECT 1 FROM public.booking_crew bc 
        WHERE bc.booking_id = b.id 
        AND bc.pilot_id = '7b7bb049-8389-4ba9-8fac-4bcb6ba23cb7'::uuid
    ) as is_crew,
    EXISTS (
        SELECT 1 FROM public.booking_editors be 
        WHERE be.booking_id = b.id 
        AND be.editor_id = '7b7bb049-8389-4ba9-8fac-4bcb6ba23cb7'::uuid
    ) as is_editor,
    -- Overall check
    (
        b.customer_id = '7b7bb049-8389-4ba9-8fac-4bcb6ba23cb7'::uuid
        OR b.pilot_id = '7b7bb049-8389-4ba9-8fac-4bcb6ba23cb7'::uuid
        OR EXISTS (SELECT 1 FROM public.booking_crew bc WHERE bc.booking_id = b.id AND bc.pilot_id = '7b7bb049-8389-4ba9-8fac-4bcb6ba23cb7'::uuid)
        OR EXISTS (SELECT 1 FROM public.booking_editors be WHERE be.booking_id = b.id AND be.editor_id = '7b7bb049-8389-4ba9-8fac-4bcb6ba23cb7'::uuid)
    ) as should_have_access
FROM public.bookings b
WHERE b.id = 'e0f47366-516e-4cb4-8379-1727369f1611'::uuid;

