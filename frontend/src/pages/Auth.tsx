import {createClient} from '@supabase/supabase-js';
import {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
} from "../config";

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

export default function Auth()
{
    async function login(provider:"github")
    {
        const {data,error} = await supabase.auth.signInWithOAuth({
            provider:'github'
        })
        
        if(error){
            alert("Error while signing in");
        }
        else{
            alert("Signed in");
        }
    }


    return <div>
        <button onClick={()=>login("github")}>Login with Github</button>
    </div>
}