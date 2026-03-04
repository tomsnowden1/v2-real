import { NavLink } from 'react-router-dom';
import { Dumbbell, History, MessageSquare, Menu, Activity } from 'lucide-react';
import './BottomNav.css';

export default function BottomNav() {
    return (
        <nav className="bottom-nav">
            <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Dumbbell size={24} />
                <span>Home</span>
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <History size={24} />
                <span>History</span>
            </NavLink>
            <NavLink to="/workout" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Activity size={24} />
                <span>Workout</span>
            </NavLink>
            <NavLink to="/coach" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <MessageSquare size={24} />
                <span>Coach</span>
            </NavLink>
            <NavLink to="/more" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Menu size={24} />
                <span>More</span>
            </NavLink>
        </nav>
    );
}
