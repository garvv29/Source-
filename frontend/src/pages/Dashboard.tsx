import { createClient } from '@supabase/supabase-js'
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
} from "../config";
import { useNavigate } from 'react-router';

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

export default function Dashboard(){
    
    const navigate = useNavigate();

    const [user,setUser] = useState<User|null>(null);
    useEffect(()=>{
        async function getInfo(){
            const {data,error} = await supabase.auth.getUser()
            if(data.user){
                setUser(data.user);
            }
        }
        getInfo();
    })
    
    return <div>
        {!user && <button onClick={()=>{
            navigate("/auth");
        }}>Sign in</button>}
        {user && <div>
            {user?.email}
            <button onClick={()=>{supabase.auth.signOut();
                setUser(null);
            }}>Logout</button>
            </div>}
    </div>
}